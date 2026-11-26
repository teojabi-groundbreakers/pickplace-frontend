import type { AiPeriodGrowth, AiPeriodMetric, Analysis, ResearchForecast } from '../types/analysis'
import { aiDisplayMetrics, aiReasonText, aiWarningText } from './aiAnalysis'
import {
  aiBasePeriodText,
  aiDraftScoreNote,
  aiFitDirection,
  aiGrowthPeriodsText,
  aiGrowthValueText,
  aiLocationNote,
  aiReferenceScopeNote,
  aiReferenceScopeText,
  aiRequestNoticeText,
  aiRequestStatusText,
  aiRiskDirection,
  aiStatisticsRows,
  fitMetricPercentileText,
  fitMetricValueText,
  fitNumberFormat,
  fitReferenceBasisNote,
  fitReferenceNotice,
  regionalSummaryRows,
  researchForecastNote,
  researchGrowthFormat,
  researchReasonText,
} from './aiPresentation'
import type { LocalResearchState } from './localResearchForecast'
import type { FitReferenceState } from './useFitReference'

export interface ReportReferences {
  research?: LocalResearchState
  fit?: FitReferenceState
}

export type PdfBadge = { label: string; tone: 'neutral' | 'positive' | 'warning' }
export type PdfDetail = { text: string; badge?: PdfBadge }
export type PdfMetric = { label: string; value: string | null; details: PdfDetail[] }
export type PdfSection =
  | { kind: 'summary'; title: string; metrics: PdfMetric[] }
  | {
      kind: 'indicators'
      title: string
      status: PdfBadge
      details: PdfDetail[]
      notice?: string
      metrics: PdfMetric[]
      footnote?: string
    }
  | { kind: 'text'; title: string; details: PdfDetail[] }

export interface ReportPdfModel {
  title: string
  region: string
  industry: string
  subtitle?: string
  sections: PdfSection[]
}

function detailLines(lines: string[]): PdfDetail[] {
  return lines.map((text) => ({ text }))
}

function researchNotice(state?: LocalResearchState): string | null {
  if (state?.status === 'loading') return '연구용 추정치를 확인 중입니다.'
  if (state?.status === 'error') return '연구용 추정치를 불러오지 못했습니다.'
  if (state?.status === 'unavailable') return '이 지역·업종의 연구용 추정치를 제공할 수 없습니다.'
  return null
}

function growthMetric(indicator: AiPeriodGrowth, research?: LocalResearchState): PdfMetric {
  const label = '매출 성장률 추정'
  if (indicator.status === 'unavailable' && research?.status === 'available') {
    const { forecast, scopeLabel } = research
    const estimate = forecast.predictions.find(
      (prediction) => prediction.targetPeriod === '2026Q4' && prediction.status === 'available',
    )
    if (estimate?.estimatedYoYGrowth != null) {
      return {
        label,
        value: researchGrowthFormat.format(estimate.estimatedYoYGrowth),
        details: [
          {
            text: aiBasePeriodText(forecast.basePeriod),
            badge: { label: '연구용 추정', tone: 'neutral' },
          },
          ...detailLines([
            `${estimate.targetPeriod} 추정 · 전년 동기 대비`,
            scopeLabel,
            researchForecastNote,
          ]),
        ],
      }
    }
  }

  const growthPeriods = aiGrowthPeriodsText(indicator)
  const lines = [aiBasePeriodText(indicator.basePeriod)]
  if (growthPeriods) lines.push(growthPeriods)
  if (indicator.status === 'unavailable') {
    lines.push(aiReasonText(indicator.reason))
    const notice = researchNotice(research)
    if (notice) lines.push(notice)
  }
  lines.push('예측값은 보장된 매출이나 창업 성공 확률이 아닙니다.')

  return {
    label,
    value: indicator.status === 'available' ? aiGrowthValueText(indicator.value) : null,
    details: detailLines(lines),
  }
}

function draftMetric(
  label: string,
  indicator: AiPeriodMetric,
  direction: string,
  comparison: string[] = [],
): PdfMetric {
  const lines: string[] = []
  if (indicator.basePeriod || comparison.length === 0)
    lines.push(aiBasePeriodText(indicator.basePeriod))
  lines.push(indicator.status === 'available' ? direction : aiReasonText(indicator.reason))
  if (indicator.status === 'available' || comparison.length === 0) lines.push(aiDraftScoreNote)
  return {
    label,
    value: indicator.status === 'available' ? `${indicator.value.toFixed(1)} / 100` : null,
    details: detailLines([...lines, ...comparison]),
  }
}

function fitComparison(state?: FitReferenceState): string[] {
  if (!state) return []
  if (state.status !== 'available') {
    const notice = fitReferenceNotice(state)
    return notice ? [notice] : []
  }
  const { referenceDate, sourceIndustryName, residentsPerStore, storesPerKm2 } = state.reference
  return [
    `서울 원천 ${sourceIndustryName} 참고 지표 · 자료 기준일 ${referenceDate}`,
    `점포당 주민 수: ${fitMetricValueText(residentsPerStore, '명')}`,
    `점포 밀집도: ${fitMetricValueText(storesPerKm2, '곳/㎢')}`,
  ]
}

function researchSection(forecast: ResearchForecast, scope?: string): PdfSection {
  return {
    kind: 'text',
    title: '연구용 매출 성장률 추정',
    details: detailLines([
      `입력 기준 ${forecast.basePeriod} · 데이터 확보 ${forecast.dataAsOf}`,
      ...(scope ? [scope] : []),
      ...forecast.predictions.map((prediction) =>
        prediction.status === 'available' && prediction.estimatedYoYGrowth !== null
          ? `${prediction.targetPeriod} 추정 · 전년 동기 대비 ${researchGrowthFormat.format(prediction.estimatedYoYGrowth)}`
          : `${prediction.targetPeriod} 추정 · 제공 불가 (${researchReasonText(prediction.reason) ?? '사유 미제공'})`,
      ),
      researchForecastNote,
    ]),
  }
}

export function buildReportPdfModel(
  result: Analysis,
  references: ReportReferences = {},
): ReportPdfModel {
  const sections: PdfSection[] = []
  const model: ReportPdfModel = {
    title: '상권 분석 결과',
    region: result.regionName,
    industry: result.industryName,
    sections,
  }
  if (result.source === 'demo') model.subtitle = '예시 분석 · 실제 상권 데이터와 다릅니다.'
  if (!result.ai && result.period)
    model.subtitle = model.subtitle
      ? `${model.subtitle} · ${result.period} 기준`
      : `${result.period} 기준`

  if (result.regionalSummary) {
    sections.push({
      kind: 'summary',
      title: '지역·업종 현황',
      metrics: regionalSummaryRows(result.regionalSummary).map(
        ({ name, display, monthLabel, referenceOn }) => ({
          label: name,
          value: display,
          details: detailLines([monthLabel, `자료 기준일 ${referenceOn}`]),
        }),
      ),
    })
  }

  if (result.ai) {
    const { ai, asOf, statistics } = result.ai
    const metrics = aiDisplayMetrics(result.ai)
    const referenceScope = aiReferenceScopeText(result.ai)
    const statisticsRows = aiStatisticsRows(statistics, Boolean(result.regionalSummary))
    const details = [`정보 기준일 ${asOf}`]
    if (statisticsRows.length)
      details.push(...statisticsRows.map(({ name, display }) => `${name}: ${display}`))
    if (!statisticsRows.length && !result.regionalSummary)
      details.push('제공 가능한 통계 값이 아직 없습니다.')
    if (referenceScope && metrics) details.push(referenceScope)
    sections.push({
      kind: 'indicators',
      title: 'AI 분석 상태',
      status: {
        label: aiRequestStatusText(ai, Boolean(metrics)),
        tone: ai.state === 'AVAILABLE' ? 'positive' : ai.state === 'FAILED' ? 'warning' : 'neutral',
      },
      details: detailLines(details),
      notice: ai.state === 'AVAILABLE' ? undefined : aiRequestNoticeText(ai, Boolean(metrics)),
      metrics: metrics
        ? [
            growthMetric(metrics.growth, references.research),
            draftMetric('위험 지수', metrics.risk, aiRiskDirection),
            draftMetric(
              '업종 적합도 지수',
              metrics.fit,
              aiFitDirection,
              fitComparison(references.fit),
            ),
          ]
        : [],
      footnote: aiLocationNote,
    })
    const notes: string[] = []
    if (referenceScope && (result.regionalSummary || statisticsRows.length))
      notes.push(aiReferenceScopeNote)
    if (references.fit?.status === 'available') notes.push(fitReferenceBasisNote)
    if (metrics) notes.push(...metrics.warnings.map(aiWarningText))
    if (notes.length)
      sections.push({ kind: 'text', title: '분석 상태 안내', details: detailLines(notes) })
  } else {
    const scoreLabels = {
      overall: '종합점수',
      growth: '성장 가능성',
      risk: '위험도',
      fit: '업종 적합도',
    }
    const scores = Object.entries(scoreLabels).flatMap(([key, label]) => {
      const score = result.scores[key as keyof typeof scoreLabels]
      return score ? [`${label}: ${score.value}점 · ${score.grade}`] : []
    })
    if (scores.length)
      sections.push({ kind: 'text', title: '상권 점수', details: detailLines(scores) })
  }

  const fit = references.fit
  const cohortSize = fit?.status === 'available' ? fit.reference.cohortSize : null
  if (fit?.status === 'available' && cohortSize !== null) {
    const { referenceDate, sourceIndustryName, residentsPerStore, storesPerKm2 } = fit.reference
    sections.push({
      kind: 'text',
      title: '서울 동일 업종 비교',
      details: detailLines([
        `${sourceIndustryName} · 서울 검증 표본 ${fitNumberFormat.format(cohortSize)}개 행정동 · ${referenceDate} 기준`,
        `점포당 주민 수 백분위: ${fitMetricPercentileText(residentsPerStore)}`,
        `점포 밀집도 백분위: ${fitMetricPercentileText(storesPerKm2)}`,
        '백분위는 검증 표본에서 해당 수치의 상대적 위치입니다.',
      ]),
    })
  }

  if (result.researchForecast) {
    sections.push(researchSection(result.researchForecast))
  } else if (!result.ai) {
    const research = references.research
    if (research?.status === 'available') {
      sections.push(researchSection(research.forecast, research.scopeLabel))
    } else {
      const notice = researchNotice(research)
      if (notice)
        sections.push({
          kind: 'text',
          title: '연구용 매출 성장률 추정',
          details: detailLines([notice]),
        })
    }
  }
  if (!result.ai && result.summary)
    sections.push({ kind: 'text', title: '진단 요약', details: detailLines([result.summary]) })
  if (result.factors.length) {
    sections.push({
      kind: 'text',
      title: '주요 영향 요인',
      details: detailLines(
        result.factors.map(
          ({ name, contribution, description }) =>
            `${name}: ${contribution > 0 ? '+' : ''}${contribution}점 · ${description}`,
        ),
      ),
    })
  }
  if (result.recommendations.length) {
    sections.push({
      kind: 'text',
      title: '추천 확인 사항',
      details: detailLines(result.recommendations),
    })
  }
  if (result.trends.length) {
    sections.push({
      kind: 'text',
      title: '월별 데이터 (매출: 만원, 유동인구: 일평균 명, 점포: 개)',
      details: detailLines(
        result.trends.map(
          (point) =>
            `${point.month} · 매출 ${point.sales ?? '미제공'} · 유동인구 ${point.population ?? '미제공'} · 점포 ${point.stores ?? '미제공'} · 개업 ${point.openings ?? '미제공'} · 폐업 ${point.closures ?? '미제공'}`,
        ),
      ),
    })
  }

  return model
}
