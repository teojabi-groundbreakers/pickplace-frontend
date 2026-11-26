import type {
  AiAnalysisDisplay,
  AiMetricDecision,
  AiPeriodGrowth,
  RegionalSummary,
} from '../types/analysis'
import { aiReasonText } from './aiAnalysis'
import { fitComparisonError, type FitMetric, type FitReferenceState } from './useFitReference'

const researchReasonLabels: Record<string, string> = {
  insufficient_history: '필요한 연속 분기 이력이 부족합니다.',
  missing_sales: '필요한 매출 자료가 없습니다.',
  invalid_sales_denominator: '성장률을 계산할 기준 매출이 없습니다.',
  missing_or_nonpositive_comparison_sales: '전년 동기의 비교 매출이 없거나 0입니다.',
  unsupported_or_insufficient_scope: '이 지역과 업종의 추정 결과를 제공할 수 없습니다.',
  unsupported_region_or_industry_code: '지원하지 않는 지역 또는 업종 코드입니다.',
  unsupported_source_or_region_code_system: '지원하지 않는 자료 출처 또는 지역 코드 체계입니다.',
  unsupported_forecast_period: '지원하지 않는 기준 분기 또는 예측 분기입니다.',
  as_of_before_model_snapshot: '모델의 데이터 확보일보다 이른 기준일은 사용할 수 없습니다.',
  as_of_in_future: '아직 오지 않은 날짜를 기준일로 사용할 수 없습니다.',
}

export function researchReasonText(reason: string | null) {
  return reason && Object.hasOwn(researchReasonLabels, reason)
    ? researchReasonLabels[reason]
    : reason
}

export const researchGrowthFormat = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

export const fitNumberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

export function fitMetricValueText(metric: FitMetric | null, unit: string) {
  return metric ? `${fitNumberFormat.format(metric.value)}${unit}` : '자료 없음'
}

export function fitMetricPercentileText(metric: FitMetric | null) {
  return metric?.percentile == null ? '자료 없음' : fitNumberFormat.format(metric.percentile)
}

export function fitReferenceNotice(state: FitReferenceState) {
  if (state.status === 'loading') return '비교 지표 조회 중…'
  if (state.status === 'error') return fitComparisonError
  if (state.status !== 'unavailable') return null
  return state.reason === 'boundary_unverified'
    ? '적합도 경계 검증 미달. 서울시와 행안부 자료의 행정동 경계가 기준만큼 겹치지 않습니다.'
    : '이 지역에 제공할 비교 지표가 없습니다.'
}

const aiStateLabels = {
  SKIPPED: '일반 AI 요청 보류',
  FAILED: 'AI 응답 실패',
  AVAILABLE: 'AI 응답 확인',
}

export const aiRiskDirection = '높을수록 위험 신호가 큽니다.'
export const aiFitDirection = '높을수록 초안 기준에서 긍정적입니다.'
export const aiDraftScoreNote = '규칙 기반 초안 지수 · 성공률이나 폐업 확률이 아닙니다.'
export const aiLocationNote =
  '지도 중심은 사용자가 선택한 카카오 지도 위치이며, 공식 행정동 대표점이나 경계를 뜻하지 않습니다.'
export const researchForecastNote =
  '서울시 추정매출을 사용한 연구 결과이며 실제 예측 성능은 검증되지 않았습니다.'
export const aiReferenceScopeNote =
  '기본 현황은 선택 업종의 수록 자료를 사용합니다. 상세 지표는 카드에 표시된 서울 원천 업종을 기준으로 해석해 주세요.'
export const fitReferenceBasisNote =
  '적합도 비교에는 기준 시점이 맞는 주민등록인구, 점포 수, 행정동 면적을 사용합니다.'

export function aiRequestStatusText(ai: AiAnalysisDisplay['ai'], hasMetrics: boolean): string {
  if (ai.state === 'SKIPPED' && ai.reason === 'region_not_supported') {
    return '서울 외 일반 AI 미지원'
  }
  return hasMetrics && ai.state === 'FAILED' ? 'AI 요청 실패 기록' : aiStateLabels[ai.state]
}

export function aiRequestNoticeText(ai: AiAnalysisDisplay['ai'], hasMetrics: boolean): string {
  const reason = aiReasonText(ai.reason)
  if (hasMetrics) return reason
  const prefix =
    ai.state === 'SKIPPED' ? '일반 AI 요청을 보내지 않았습니다.' : 'AI 결과를 받지 못했습니다.'
  return `${prefix} ${reason}`
}

export function aiGrowthValueText(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

export function aiBasePeriodText(period: string | null): string {
  return period ? `${period} 기준` : '기준 분기 미확정'
}

export function aiReferenceScopeText(data: AiAnalysisDisplay): string | null {
  const scope = data.schemaVersion === '2.0' ? data.ai.analysisScope : null
  return scope?.referenceOnly ? `서울 원천 업종 참고 분석 · ${scope.sourceIndustryName} 기준` : null
}

export function aiGrowthPeriodsText(growth: AiPeriodGrowth): string {
  const periods = []
  if (growth.targetPeriod) periods.push(`예측 대상 ${growth.targetPeriod}`)
  if (growth.comparisonPeriod) periods.push(`비교 ${growth.comparisonPeriod}`)
  return periods.join(' · ')
}

const statLabels: Record<string, { name: string; unit: string }> = {
  registeredPopulation: { name: '등록인구', unit: '명' },
  listedStoreCount: { name: '등록 점포 수', unit: '개' },
  residentPopulation: { name: '상주인구', unit: '명' },
  totalStoreCount: { name: '전체 점포 수', unit: '개' },
}

const statReasons: Record<string, string> = {
  SOURCE_SUPPRESSED: '원천에서 공개하지 않은 값입니다.',
  CLASSIFICATION_MISMATCH: '원천의 업종 분류가 일치하지 않습니다.',
  MAPPING_UNRESOLVED: '원천과 서비스의 코드 대응을 확인하지 못했습니다.',
  BOUNDARY_REVIEW_PENDING: '행정구역 경계 검토가 필요합니다.',
  BOUNDARY_MISMATCH: '원천과 서비스의 행정구역 경계가 다릅니다.',
  COUNT_INCOMPLETE: '집계가 완료되지 않았습니다.',
  QUALITY_CHECK_FAILED: '자료 품질 검증을 통과하지 못했습니다.',
  SOURCE_REGION_ABSENT: '원천에 해당 지역 자료가 없습니다.',
  SOURCE_ROW_ABSENT: '원천에 해당 조건의 자료가 없습니다.',
  SOURCE_VALUE_MISSING: '원천에 값이 없습니다.',
}

export function aiStatisticsRows(
  statistics: AiAnalysisDisplay['statistics'],
  hasRegionalSummary = false,
) {
  return Object.entries(statistics.metrics)
    .filter(
      ([key]) =>
        !hasRegionalSummary || (key !== 'registeredPopulation' && key !== 'listedStoreCount'),
    )
    .map(([key, metric]) => {
      const label = Object.hasOwn(statLabels, key) ? statLabels[key] : undefined

      return {
        key,
        name: label?.name ?? key,
        display: statisticText(metric, label?.unit ?? ''),
      }
    })
}

function statisticText(metric: AiMetricDecision, unit: string) {
  if (metric.status === 'AVAILABLE' && metric.value !== null) {
    return `${metric.value.toLocaleString('ko-KR')}${unit}`
  }

  const reason = metric.reasonCode
  const status = metric.status === 'NO_DATA' ? '자료 없음' : '제공 불가'
  return `${status} · ${reason && Object.hasOwn(statReasons, reason) ? statReasons[reason] : aiReasonText(reason)}`
}

export function regionalSummaryRows(summary: RegionalSummary) {
  const { registeredPopulation, listedStoreCount } = summary.data.metrics

  return [
    {
      name: '등록인구',
      metric: registeredPopulation,
      unit: '명',
    },
    {
      name: '선택 업종 수록 업소 수',
      metric: listedStoreCount,
      unit: '개',
    },
  ].map(({ name, metric, unit }) => {
    const { referenceOn } = metric.source
    const [year, month] = referenceOn.split('-')

    return {
      name,
      display: statisticText(metric, unit),
      available: metric.status === 'AVAILABLE',
      referenceOn,
      monthLabel: `${year}년 ${Number(month)}월 기준`,
    }
  })
}
