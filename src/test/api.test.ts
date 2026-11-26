import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyze, ApiError, getCatalog, requestJson } from '../lib/api'
import { config } from '../lib/config'
import { createDemoAnalysis, defaultRequest, demoCatalog } from '../data/demo'
import { isAnalysis, isCatalog, validateSelection } from '../lib/validation'
import { buildReportPdfModel } from '../lib/reportPdfModel'
import { aiPeriodTestEnvelope, aiTestContext, aiTestEnvelope, aiTestRequest } from './aiFixtures'

const fetchMock = vi.fn()
beforeEach(() => {
  config.demoMode = false
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  config.demoMode = true
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('API 계약 및 오류 처리', () => {
  it('목록 응답을 검증하고 실제 AI 분석 요청을 JSON으로 전송한다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(demoCatalog)))
    expect(await getCatalog()).toEqual(demoCatalog)
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(aiTestEnvelope())))
    const result = await analyze(aiTestRequest, undefined, 'success', aiTestContext)
    expect(result).toMatchObject({
      source: 'api',
      scores: { overall: null, growth: null, risk: null, fit: null },
    })
    expect(result.ai?.ai).toMatchObject({
      result: { growth: { status: 'unavailable', reason: 'model_not_found' } },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/analyses',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(aiTestRequest) }),
    )
  })

  it('각 지표의 별도 기준월을 AI 상태·추이와 구분해 저장하고 보고서에 표시한다', async () => {
    const envelope = {
      data: {
        region: { regionCode: aiTestRequest.regionCode },
        businessType: { businessTypeCode: aiTestRequest.industryCode },
        metrics: {
          registeredPopulation: {
            value: 10501,
            unit: 'PERSON',
            status: 'AVAILABLE',
            reasonCode: null,
            source: { datasetCode: 'POPULATION_MONTH', referenceOn: '2026-10-31' },
          },
          listedStoreCount: {
            value: 0,
            unit: 'STORE',
            status: 'AVAILABLE',
            reasonCode: null,
            source: { datasetCode: 'STORE_SNAPSHOT', referenceOn: '2026-09-30' },
          },
        },
      },
      meta: { requestId: 'regional-summary', referenceMonth: '202609' },
    }
    const aiEnvelope = aiTestEnvelope(aiTestRequest, 'SKIPPED')
    aiEnvelope.data.statistics.metrics = {
      registeredPopulation: { value: 20001, status: 'AVAILABLE', reasonCode: null },
      listedStoreCount: { value: 99, status: 'AVAILABLE', reasonCode: null },
    }
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(aiEnvelope)))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope)))

    const result = await analyze(aiTestRequest, undefined, 'success', aiTestContext)

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/regions/1111051500/summary?businessTypeCode=I21201',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(result.regionalSummary).toEqual(envelope)
    expect(result.ai?.ai.state).toBe('SKIPPED')
    expect(result.trends).toEqual([])
    expect(isAnalysis(JSON.parse(JSON.stringify(result)))).toBe(true)
    const report = buildReportPdfModel(result)
    expect(report.sections[0]).toMatchObject({
      kind: 'summary',
      title: '지역·업종 현황',
      metrics: [
        {
          label: '등록인구',
          value: '10,501명',
          details: expect.arrayContaining([
            { text: '2026년 10월 기준' },
            { text: expect.stringContaining('2026-10-31') },
          ]),
        },
        {
          label: '선택 업종 수록 업소 수',
          value: '0개',
          details: expect.arrayContaining([
            { text: '2026년 9월 기준' },
            { text: expect.stringContaining('2026-09-30') },
          ]),
        },
      ],
    })

    expect(JSON.stringify(report.sections)).not.toMatch(/20,001명|99개/)

    envelope.data.region.regionCode = '1111053000'
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(aiTestEnvelope(aiTestRequest, 'SKIPPED'))))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope)))
    const mismatched = await analyze(aiTestRequest, undefined, 'success', aiTestContext)
    expect(mismatched.regionalSummary).toBeUndefined()
    expect(mismatched.ai?.ai.state).toBe('SKIPPED')
  })

  it('보류 상태의 null 결과와 사유를 화면 결과에 보존한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(aiTestEnvelope(aiTestRequest, 'SKIPPED'))),
    )
    const result = await analyze(aiTestRequest, undefined, 'success', aiTestContext)
    expect(result.ai?.ai).toMatchObject({
      state: 'SKIPPED',
      reason: 'mapping_unverified',
      result: null,
    })
    expect(result.scores.overall).toBeNull()
    expect(result.trends).toEqual([])
  })

  it('지표마다 다른 기준 분기와 부분 결과를 공개 v2 응답에서 보존한다', async () => {
    const { data, meta } = aiPeriodTestEnvelope()
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data, meta })))

    const result = await analyze(aiTestRequest, undefined, 'success', aiTestContext)

    expect(result.period).toBeNull()
    expect(result.scores.overall).toBeNull()
    expect(result.ai).toEqual({ ...data, requestId: meta.requestId })
  })

  it('아직 종료되지 않은 대상 분기의 0% 성장 추정을 제공 값으로 읽는다', async () => {
    const { data, meta } = aiPeriodTestEnvelope()
    data.ai.metrics.growth = {
      basePeriod: '2026Q3',
      targetPeriod: '2026Q4',
      comparisonPeriod: '2025Q4',
      status: 'available',
      value: 0,
      reason: null,
    }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data, meta })))

    const result = await analyze(aiTestRequest, undefined, 'success', aiTestContext)

    expect(result.ai?.ai).toMatchObject({ metrics: { growth: data.ai.metrics.growth } })
  })

  it.each([
    ['기준 분기가 없는 제공 지표', 'risk', { basePeriod: null }],
    ['미제공인데 0을 반환한 지표', 'growth', { value: 0 }],
    ['잘못된 예측 대상 분기', 'growth', { targetPeriod: '2026Q5' }],
    ['이미 끝난 분기의 제공 예측', 'growth', { status: 'available', value: 0.1, reason: null }],
  ] as const)('공개 v2 응답에서 %s를 거부한다', async (_label, metric, override) => {
    const { data, meta } = aiPeriodTestEnvelope()
    const metrics = {
      ...data.ai.metrics,
      [metric]: { ...data.ai.metrics[metric], ...override },
    }
    const invalidData = { ...data, ai: { ...data.ai, metrics } }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: invalidData, meta })))

    await expect(analyze(aiTestRequest, undefined, 'success', aiTestContext)).rejects.toMatchObject(
      {
        code: 'INVALID_RESPONSE',
        requestId: meta.requestId,
      },
    )
  })

  it('이전 원본 Analysis 응답을 실제 AI 응답으로 받아들이지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(createDemoAnalysis(defaultRequest))),
    )
    await expect(analyze(aiTestRequest, undefined, 'success', aiTestContext)).rejects.toMatchObject(
      { code: 'INVALID_RESPONSE' },
    )
  })

  it('데이터 부족 응답 코드를 보존한다', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'INSUFFICIENT_DATA' }), { status: 422 }),
    )
    await expect(analyze(aiTestRequest, undefined, 'success', aiTestContext)).rejects.toMatchObject(
      {
        code: 'REQUEST_FAILED',
        status: 422,
      },
    )
  })

  it('서버 장애와 잘못된 JSON 응답을 데모로 대체하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('gateway error', { status: 503 }))
    await expect(analyze(aiTestRequest, undefined, 'success', aiTestContext)).rejects.toMatchObject(
      { status: 503 },
    )
    fetchMock.mockResolvedValueOnce(new Response('{invalid json'))
    await expect(analyze(aiTestRequest, undefined, 'success', aiTestContext)).rejects.toMatchObject(
      { code: 'INVALID_RESPONSE' },
    )
  })

  it('요청한 지역과 다른 결과를 거부한다', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(aiTestEnvelope({ ...aiTestRequest, regionCode: '1144060000' }))),
    )
    await expect(analyze(aiTestRequest, undefined, 'success', aiTestContext)).rejects.toMatchObject(
      { code: 'INVALID_RESPONSE' },
    )
  })

  it('통신 오류와 타임아웃을 구분한다', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(requestJson('/catalog', isCatalog)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    fetchMock.mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError'))
    await expect(requestJson('/catalog', isCatalog)).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('일반 응답의 JSON 형식 오류에서도 헤더의 요청 ID를 보존한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{invalid json', { headers: { 'X-Request-Id': 'raw-invalid-id' } }),
    )
    await expect(requestJson('/catalog', isCatalog)).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE',
      requestId: 'raw-invalid-id',
    })
  })

  it('호출자가 취소한 요청은 네트워크 오류로 바꾸지 않는다', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValue(error)
    await expect(getCatalog(controller.signal)).rejects.toBe(error)
  })

  it('데모 시나리오와 취소 요청이 실제 서버에 접근하지 않는다', async () => {
    config.demoMode = true
    vi.useFakeTimers()
    const failure = analyze(defaultRequest, undefined, 'empty').catch((error) => error as ApiError)
    await vi.advanceTimersByTimeAsync(900)
    expect(await failure).toMatchObject({ code: 'INSUFFICIENT_DATA' })
    const controller = new AbortController()
    const cancelled = analyze(defaultRequest, controller.signal).catch((error) => error)
    controller.abort()
    expect(await cancelled).toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('데모 모드에서도 조회한 10자리 코드를 보존하며 예시 없는 지역은 데이터 부족으로 처리한다', async () => {
    config.demoMode = true
    vi.useFakeTimers()
    const request = { ...defaultRequest, regionCode: `${defaultRequest.regionCode}00` }
    const known = analyze(request)
    await vi.advanceTimersByTimeAsync(900)
    expect(await known).toMatchObject({ request, source: 'demo' })
    const unknown = expect(analyze({ ...request, regionCode: '1117065000' })).rejects.toMatchObject(
      { code: 'INSUFFICIENT_DATA', message: expect.stringContaining('데모') },
    )
    await vi.advanceTimersByTimeAsync(900)
    await unknown
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('응답 검증', () => {
  it('잘못된 점수, 빈 시계열, 좌표 범위를 거부한다', () => {
    const result = createDemoAnalysis(defaultRequest)
    expect(isAnalysis(result)).toBe(true)
    expect(
      isAnalysis({
        ...result,
        scores: { ...result.scores, risk: { ...result.scores.risk, value: 120 } },
      }),
    ).toBe(false)
    expect(isAnalysis({ ...result, trends: [] })).toBe(true)
    expect(isAnalysis({ ...result, map: { ...result.map, center: [120, 127] } })).toBe(false)
    expect(isCatalog({ cities: [], categories: [] })).toBe(false)
    expect(
      validateSelection({ ...defaultRequest, regionCode: 'invalid' }, demoCatalog),
    ).toBeTruthy()
  })
})
