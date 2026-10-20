import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyze, ApiError, getCatalog, requestJson } from '../lib/api'
import { config } from '../lib/config'
import { createDemoAnalysis, defaultRequest, demoCatalog } from '../data/demo'
import { isAnalysis, isCatalog, validateSelection } from '../lib/validation'

const fetchMock = vi.fn()
beforeEach(() => {
  config.demoMode = false
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  config.demoMode = true
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('API 계약 및 오류 처리', () => {
  it('목록 응답을 검증하고 분석 요청을 JSON으로 전송한다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(demoCatalog)))
    expect(await getCatalog()).toEqual(demoCatalog)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(createDemoAnalysis(defaultRequest))),
    )
    expect((await analyze(defaultRequest)).source).toBe('api')
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/analyses',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(defaultRequest) }),
    )
  })

  it('데이터 부족 응답 코드를 보존한다', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'INSUFFICIENT_DATA' }), { status: 422 }),
    )
    await expect(analyze(defaultRequest)).rejects.toMatchObject({
      code: 'INSUFFICIENT_DATA',
      status: 422,
    })
  })

  it('서버 장애와 잘못된 JSON 응답을 데모로 대체하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('gateway error', { status: 503 }))
    await expect(analyze(defaultRequest)).rejects.toMatchObject({ status: 503 })
    fetchMock.mockResolvedValueOnce(new Response('{invalid json'))
    await expect(analyze(defaultRequest)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('요청한 지역과 다른 결과를 거부한다', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(createDemoAnalysis({ ...defaultRequest, regionCode: '11440600' })),
      ),
    )
    await expect(analyze(defaultRequest)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('통신 오류와 타임아웃을 구분한다', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(requestJson('/catalog', isCatalog)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    fetchMock.mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError'))
    await expect(requestJson('/catalog', isCatalog)).rejects.toMatchObject({ code: 'TIMEOUT' })
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
    expect(isAnalysis({ ...result, trends: [] })).toBe(false)
    expect(isAnalysis({ ...result, map: { ...result.map, center: [120, 127] } })).toBe(false)
    expect(isCatalog({ cities: [], categories: [] })).toBe(false)
    expect(
      validateSelection({ ...defaultRequest, regionCode: 'invalid' }, demoCatalog),
    ).toBeTruthy()
  })
})
