import { describe, expect, it } from 'vitest'
import { toAnalysis } from '../lib/aiAnalysis'
import { buildReportPdfModel } from '../lib/reportPdfModel'
import { aiPeriodTestEnvelope, aiTestContext, aiTestRequest } from './aiFixtures'

describe('PDF 보고서에 쓰는 분석 내용', () => {
  const { data, meta } = aiPeriodTestEnvelope()
  const result = toAnalysis(aiTestRequest, data, meta.requestId, aiTestContext)

  it('화면에서 확인한 연구 추정과 비교 지표의 경계 보류 이유를 담는다', () => {
    const fixture = aiPeriodTestEnvelope()
    fixture.data.ai.metrics.fit = {
      status: 'unavailable',
      value: null,
      basePeriod: null,
      reason: 'insufficient_verified_data',
    }
    const report = buildReportPdfModel(
      toAnalysis(aiTestRequest, fixture.data, fixture.meta.requestId, aiTestContext),
      {
        research: {
          status: 'available',
          scopeLabel: '장충동 · 서울 원천 커피-음료 기준 (CS100010)',
          forecast: {
            mode: 'experimental_research_only',
            method: 'model_inference',
            basePeriod: '2026Q2',
            dataAsOf: '2026-11-25',
            modelVersion: 'test',
            inputValuesVerified: false,
            regionScopeVerified: false,
            predictions: [
              {
                status: 'available',
                targetPeriod: '2026Q4',
                estimateKind: 'in_progress_or_future_quarter_estimate',
                estimatedYoYGrowth: 0.144,
                reason: null,
                warnings: [],
              },
            ],
          },
        },
        fit: { status: 'unavailable', reason: 'boundary_unverified' },
      },
    )

    const diagnosis = report.sections.find((section) => section.kind === 'indicators')
    expect(diagnosis?.metrics[0]).toMatchObject({
      label: '매출 성장률 추정',
      value: '+14.4%',
      details: expect.arrayContaining([
        { text: '2026Q2 기준', badge: { label: '연구용 추정', tone: 'neutral' } },
        { text: '2026Q4 추정 · 전년 동기 대비' },
        { text: '장충동 · 서울 원천 커피-음료 기준 (CS100010)' },
      ]),
    })
    const growthDetails = diagnosis?.metrics[0].details.map(({ text }) => text)
    expect(growthDetails).not.toContain('예측 대상 분기가 분석 기준일보다 이후가 아닙니다.')
    expect(diagnosis?.metrics[2]).toMatchObject({
      label: '업종 적합도 지수',
      value: null,
      details: expect.arrayContaining([{ text: expect.stringContaining('적합도 경계 검증 미달') }]),
    })
  })

  it('비교 지표 값, 기준일, 표본과 미제공 항목을 구분한다', () => {
    const report = buildReportPdfModel(result, {
      fit: {
        status: 'available',
        reference: {
          referenceDate: '2026-06-30',
          sourceIndustryName: '커피 전문점',
          cohortSize: 121,
          residentsPerStore: { value: 86.15, percentile: 43.2 },
          storesPerKm2: null,
        },
      },
    })

    const diagnosis = report.sections.find((section) => section.kind === 'indicators')
    const comparisonText = diagnosis?.metrics[2].details.map(({ text }) => text).join(' ')
    expect(comparisonText).toContain('커피 전문점')
    expect(comparisonText).toContain('2026-06-30')
    expect(comparisonText).toContain('86.15명')
    expect(comparisonText).toContain('자료 없음')

    const benchmark = report.sections.find((section) => section.title === '서울 동일 업종 비교')
    expect(JSON.stringify(benchmark)).toContain('43.2')
    expect(JSON.stringify(benchmark)).toContain('121개 행정동')
  })
})
