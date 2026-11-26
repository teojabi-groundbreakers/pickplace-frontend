import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiDiagnosis } from '../components/AiDiagnosis'
import { isAiAnalysisResponse, toAnalysis } from '../lib/aiAnalysis'
import { getLocalResearchForecast, type LocalResearchResult } from '../lib/localResearchForecast'
import { persistReports, readReports } from '../lib/reports'
import { buildReportPdfModel } from '../lib/reportPdfModel'
import { Saved } from '../pages/Saved'
import { aiPeriodTestEnvelope, aiTestContext, aiTestEnvelope, aiTestRequest } from './aiFixtures'

vi.mock('../lib/localResearchForecast', () => ({
  getLocalResearchForecast: vi.fn(),
}))
vi.mock('../lib/useFitReference', () => ({
  useFitReference: () => ({ status: 'idle' }),
}))
vi.mock('../components/FitComparison', () => ({
  FitReferenceIndicators: () => null,
  FitReferenceBenchmark: () => null,
}))

const loadResearch = vi.mocked(getLocalResearchForecast)
const coffeeResearch: LocalResearchResult = {
  status: 'available',
  scopeLabel: '청운효자동 · 서울 원천 커피 전문점 기준 (CS100010)',
  forecast: {
    mode: 'experimental_research_only',
    method: 'model_inference',
    basePeriod: '2026Q2',
    dataAsOf: '2026-11-20',
    modelVersion: 'test',
    inputValuesVerified: false,
    regionScopeVerified: false,
    predictions: [
      {
        status: 'available',
        targetPeriod: '2026Q4',
        estimatedYoYGrowth: -0.0921,
        reason: null,
        estimateKind: 'in_progress_or_future_quarter_estimate',
        warnings: [],
      },
    ],
  },
}

beforeEach(() => {
  loadResearch.mockReset()
})

function indicatorCard(heading: string) {
  const card = screen.getByRole('heading', { name: heading }).closest('article')
  if (!card) throw new Error(`지표 카드 없음: ${heading}`)
  return within(card)
}

describe('AI 부분 결과 안내와 보고서', () => {
  it('성장률 카드에서 2분기 자료를 사용한 4분기 연구 결과를 자동 표시한다', async () => {
    const { data, meta } = aiPeriodTestEnvelope()
    loadResearch.mockResolvedValue(coffeeResearch)
    render(
      <AiDiagnosis
        data={{ ...data, requestId: meta.requestId }}
        localReferenceSelection={data.request}
      />,
    )

    const growth = indicatorCard('매출 성장률 추정')
    expect(await growth.findByText('-9.2%')).toBeInTheDocument()
    expect(growth.getByText('연구용 추정')).toBeInTheDocument()
    expect(growth.getByText('2026Q2 기준')).toBeInTheDocument()
    expect(growth.getByText('2026Q4 추정 · 전년 동기 대비')).toBeInTheDocument()
    expect(growth.getByText(coffeeResearch.scopeLabel)).toBeInTheDocument()
    expect(growth.queryByText(/제공 불가/)).not.toBeInTheDocument()
    expect(indicatorCard('위험 지수').getByText('42.0 / 100')).toBeInTheDocument()
  })

  it('일반 성장률이 있으면 연구 요청을 보내지 않는다', () => {
    const { data, meta } = aiPeriodTestEnvelope()
    data.ai.metrics.growth = {
      status: 'available',
      basePeriod: '2026Q3',
      targetPeriod: '2026Q4',
      comparisonPeriod: '2025Q4',
      value: 0.075,
      reason: null,
    }
    render(
      <AiDiagnosis
        data={{ ...data, requestId: meta.requestId }}
        localReferenceSelection={data.request}
      />,
    )

    expect(indicatorCard('매출 성장률 추정').getByText('+7.5%')).toBeInTheDocument()
    expect(loadResearch).not.toHaveBeenCalled()
  })

  it('연구 범위가 없으면 일반 성장률 제공 불가 사유를 유지한다', async () => {
    const { data, meta } = aiPeriodTestEnvelope()
    loadResearch.mockResolvedValue({ status: 'unavailable' })
    render(
      <AiDiagnosis
        data={{ ...data, requestId: meta.requestId }}
        localReferenceSelection={data.request}
      />,
    )

    const growth = indicatorCard('매출 성장률 추정')
    expect(
      await growth.findByText('이 지역·업종의 연구용 추정치를 제공할 수 없습니다.'),
    ).toBeInTheDocument()
    expect(growth.getByText(/예측 대상 분기가 분석 기준일보다 이후가 아닙니다/)).toBeInTheDocument()
    expect(growth.queryByText('연구용 추정')).not.toBeInTheDocument()
  })

  it('기존 결과와 선택이 달라지면 연구 요청을 취소한다', () => {
    const { data, meta } = aiPeriodTestEnvelope()
    loadResearch.mockReturnValue(new Promise(() => {}))
    const displayData = { ...data, requestId: meta.requestId }
    const { rerender } = render(
      <AiDiagnosis
        data={displayData}
        localReferenceSelection={data.request}
      />,
    )
    const [, signal] = loadResearch.mock.calls[0]

    rerender(
      <AiDiagnosis
        data={displayData}
        localReferenceSelection={{ ...data.request, industryCode: 'I21007' }}
      />,
    )

    expect(signal.aborted).toBe(true)
    expect(loadResearch).toHaveBeenCalledTimes(1)
  })

  it('지역·업종 대응이 미승인이어도 로컬 연구 결과와 기본 통계를 함께 표시한다', async () => {
    const { data, meta } = aiPeriodTestEnvelope()
    const reason = 'mapping_unverified'
    const unavailable = { basePeriod: null, status: 'unavailable' as const, value: null, reason }
    data.ai.state = 'SKIPPED'
    data.ai.reason = reason
    data.ai.metrics = {
      growth: { ...unavailable, targetPeriod: null, comparisonPeriod: null },
      risk: unavailable,
      fit: unavailable,
    }
    loadResearch.mockResolvedValue(coffeeResearch)

    render(
      <AiDiagnosis
        data={{ ...data, requestId: meta.requestId }}
        localReferenceSelection={data.request}
      />,
    )

    const growth = indicatorCard('매출 성장률 추정')
    expect(await growth.findByText('-9.2%')).toBeInTheDocument()
    expect(screen.getByText('일반 AI 요청 보류')).toBeInTheDocument()
    const diagnosis = screen.getByRole('region', { name: 'AI 분석 상태와 제공 가능한 결과' })
    expect(within(diagnosis).getByRole('status')).toHaveTextContent(
      '일반 AI 분석에 필요한 지역·업종 대응이 아직 승인되지 않았습니다.',
    )
    expect(growth.getByText('연구용 추정')).toBeInTheDocument()
    expect(screen.getByText('100명')).toBeInTheDocument()
  })

  it('서울 외 지역의 일반 AI 미지원과 기본 통계를 함께 표시한다', () => {
    const { data, meta } = aiPeriodTestEnvelope()
    const reason = 'region_not_supported'
    const unavailable = { basePeriod: null, status: 'unavailable' as const, value: null, reason }
    data.request = { regionCode: '2611051000', industryCode: 'I21201' }
    data.ai.state = 'SKIPPED'
    data.ai.reason = reason
    data.ai.metrics = {
      growth: { ...unavailable, targetPeriod: null, comparisonPeriod: null },
      risk: unavailable,
      fit: unavailable,
    }

    render(<AiDiagnosis data={{ ...data, requestId: meta.requestId }} />)

    expect(screen.getByText('서울 외 일반 AI 미지원')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '일반 AI 분석은 현재 서울 지역만 지원합니다.',
    )
    expect(screen.queryByText('일반 AI 요청 보류')).not.toBeInTheDocument()
    expect(screen.getByText('100명')).toBeInTheDocument()
    expect(loadResearch).not.toHaveBeenCalled()
  })

  it('AI 호출 실패 상태와 한국어 사유를 표시한다', () => {
    const data = aiTestEnvelope(aiTestRequest, 'FAILED').data
    data.ai.reason = 'ai_timeout'
    data.ai.transportStatus = 'UNAVAILABLE'
    render(<AiDiagnosis data={{ ...data, requestId: 'failed-test' }} />)
    expect(screen.getByText('AI 응답 실패')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('AI 서버의 응답 시간이 초과되었습니다.')
    expect(screen.queryByText('42.0 / 100')).not.toBeInTheDocument()
  })

  it('기존 v1 저장본을 다시 읽고 지표별 기준 분기와 주의사항을 보고서에 남긴다', () => {
    const envelope = aiTestEnvelope()
    const legacy = toAnalysis(aiTestRequest, envelope.data, envelope.meta.requestId, aiTestContext)
    localStorage.setItem('pickplace.reports.v1', JSON.stringify([legacy]))
    const [restored] = readReports()
    expect(restored).toEqual(legacy)
    expect(restored.period).toBe('2026Q3')

    const report = buildReportPdfModel(restored)
    const diagnosis = report.sections.find((section) => section.kind === 'indicators')
    expect(diagnosis?.metrics[0]).toMatchObject({
      label: '매출 성장률 추정',
      value: null,
      details: expect.arrayContaining([
        { text: '2026Q3 기준' },
        { text: '예측 대상 2026Q4 · 비교 2025Q4' },
        { text: '사용 가능한 예측 모델 파일이 없습니다.' },
      ]),
    })
    expect(report.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'text',
          title: '분석 상태 안내',
          details: expect.arrayContaining([{ text: '위험·적합도 지수는 검증 중인 초안입니다.' }]),
        }),
      ]),
    )
  })

  it('부분 대응의 실제 분석 범위를 지표 카드와 저장된 보고서에 표시한다', () => {
    const { data, meta } = aiPeriodTestEnvelope()
    data.ai.analysisScope = {
      sourceRegionCode: '11110515',
      sourceIndustryCode: 'CS100010',
      sourceIndustryName: '커피 전문점',
      industryMatch: 'PARTIAL',
      referenceOnly: true,
    }
    data.ai.metrics.fit = {
      basePeriod: null,
      status: 'unavailable',
      value: null,
      reason: 'insufficient_verified_data',
    }
    const scopeText = '서울 원천 업종 참고 분석 · 커피 전문점 기준'

    expect(isAiAnalysisResponse(data)).toBe(true)
    render(<AiDiagnosis data={{ ...data, requestId: meta.requestId }} />)
    expect(screen.getByText(scopeText)).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: '분석 상태 안내' })).getByText(
        /선택 업종의 수록 자료/,
      ),
    ).toBeInTheDocument()
    expect(
      indicatorCard('업종 적합도 지수').getByText(/검증된 자료가 부족합니다/),
    ).toBeInTheDocument()
    expect(indicatorCard('위험 지수').getByText('42.0 / 100')).toBeInTheDocument()
    expect(screen.getByText('상주인구')).toBeInTheDocument()

    persistReports([toAnalysis(aiTestRequest, data, meta.requestId, aiTestContext)])
    const [restored] = readReports()
    const diagnosis = buildReportPdfModel(restored).sections.find(
      (section) => section.kind === 'indicators',
    )
    expect(diagnosis?.details).toEqual(expect.arrayContaining([{ text: scopeText }]))

    data.ai.analysisScope.referenceOnly = false
    expect(isAiAnalysisResponse(data)).toBe(false)
  })

  it('AI 호출 실패가 다른 분기의 지표와 기본 통계를 가리지 않는다', () => {
    const { data, meta } = aiPeriodTestEnvelope()
    data.ai.state = 'FAILED'
    data.ai.reason = 'ai_timeout'
    render(<AiDiagnosis data={{ ...data, requestId: meta.requestId }} />)

    expect(screen.getByText(/정보 기준일 2026-11-16/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('AI 서버의 응답 시간이 초과되었습니다.')
    const growth = indicatorCard('매출 성장률 추정')
    expect(growth.getByText('2026Q2 기준')).toBeInTheDocument()
    expect(growth.getByText('예측 대상 2026Q3 · 비교 2025Q3')).toBeInTheDocument()
    expect(growth.getByText(/예측 대상 분기가 분석 기준일보다 이후가 아닙니다/)).toBeInTheDocument()
    const risk = indicatorCard('위험 지수')
    expect(risk.getByText('2026Q2 기준')).toBeInTheDocument()
    expect(risk.getByText('42.0 / 100')).toBeInTheDocument()
    const fit = indicatorCard('업종 적합도 지수')
    expect(fit.getByText('2026Q3 기준')).toBeInTheDocument()
    expect(fit.getByText('65.0 / 100')).toBeInTheDocument()
    expect(screen.getByText('상주인구')).toBeInTheDocument()
    expect(screen.getByText(/100명/)).toBeInTheDocument()
    expect(screen.getByText(/자료의 사용 승인을 확인하지 못했습니다/)).toBeInTheDocument()

    const report = buildReportPdfModel(
      toAnalysis(aiTestRequest, data, meta.requestId, aiTestContext),
    )
    const diagnosis = report.sections.find((section) => section.kind === 'indicators')
    expect(diagnosis).toMatchObject({
      status: { label: 'AI 요청 실패 기록' },
      metrics: [
        {
          label: '매출 성장률 추정',
          value: null,
          details: expect.arrayContaining([
            { text: '2026Q2 기준' },
            { text: '예측 대상 2026Q3 · 비교 2025Q3' },
          ]),
        },
        {
          label: '위험 지수',
          value: '42.0 / 100',
          details: expect.arrayContaining([{ text: '2026Q2 기준' }]),
        },
        {
          label: '업종 적합도 지수',
          value: '65.0 / 100',
          details: expect.arrayContaining([{ text: '2026Q3 기준' }]),
        },
      ],
    })
    expect(diagnosis?.details).toEqual(
      expect.arrayContaining([
        { text: expect.stringContaining('자료의 사용 승인을 확인하지 못했습니다.') },
      ]),
    )
  })

  it('적합도만 제공되는 경우 0점과 기준 미확정 지표를 구분하고 저장 후 다시 연다', () => {
    const { data, meta } = aiPeriodTestEnvelope()
    data.ai.metrics.growth = {
      basePeriod: null,
      targetPeriod: null,
      comparisonPeriod: null,
      status: 'unavailable',
      value: null,
      reason: 'missing_base_period',
    }
    data.ai.metrics.risk = {
      basePeriod: null,
      status: 'unavailable',
      value: null,
      reason: 'missing_risk_indicators',
    }
    data.ai.metrics.fit = { basePeriod: '2026Q3', status: 'available', value: 0, reason: null }

    const analysis = toAnalysis(aiTestRequest, data, meta.requestId, aiTestContext)
    persistReports([analysis])
    const reports = readReports()
    expect(reports).toEqual([analysis])

    const open = vi.fn()
    render(
      <MemoryRouter>
        <Saved
          reports={reports}
          onOpen={open}
          onRemove={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/정보 기준일 2026-11-16/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '분석 다시 보기' }))
    expect(open).toHaveBeenCalledWith(analysis)

    render(<AiDiagnosis data={{ ...data, requestId: meta.requestId }} />)
    const growth = indicatorCard('매출 성장률 추정')
    expect(growth.getByText('기준 분기 미확정')).toBeInTheDocument()
    expect(growth.getByText(/기준 분기의 자료가 없습니다/)).toBeInTheDocument()
    expect(growth.queryByText(/예측 대상/)).not.toBeInTheDocument()
    const risk = indicatorCard('위험 지수')
    expect(risk.queryByText('0.0 / 100')).not.toBeInTheDocument()
    const fit = indicatorCard('업종 적합도 지수')
    expect(fit.getByText('0.0 / 100')).toBeInTheDocument()
  })
})
