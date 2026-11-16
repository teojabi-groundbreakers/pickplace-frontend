import type {
  AiAnalysisDisplay,
  AiAnalysisResponse,
  AiIndicator,
  AiModelResult,
  AiPeriodMetric,
  AiPeriodMetrics,
  Analysis,
  AnalysisDisplayContext,
  AnalysisRequest,
} from '../types/analysis'

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const quarter = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}Q[1-4]$/.test(value)

const calendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const nullableText = (value: unknown): value is string | null => value === null || text(value)

function isMetric(value: unknown): boolean {
  if (!object(value)) return false
  if (value.status === 'AVAILABLE') {
    return (
      Number.isSafeInteger(value.value) && Number(value.value) >= 0 && value.reasonCode === null
    )
  }
  return (
    (value.status === 'NO_DATA' || value.status === 'UNAVAILABLE') &&
    value.value === null &&
    text(value.reasonCode)
  )
}

function isIndicator(value: unknown): value is AiIndicator {
  if (
    !object(value) ||
    !text(value.policy_status) ||
    !Array.isArray(value.components) ||
    value.components.length > 16 ||
    !value.components.every(
      (item) =>
        object(item) &&
        text(item.name) &&
        text(item.unit) &&
        finite(item.value) &&
        finite(item.contribution_points),
    )
  ) {
    return false
  }

  return (
    (value.status === 'available' &&
      finite(value.score) &&
      value.score >= 0 &&
      value.score <= 100 &&
      value.reason === null) ||
    (value.status === 'unavailable' && value.score === null && text(value.reason))
  )
}

function isGrowth(value: unknown): boolean {
  if (
    !object(value) ||
    !quarter(value.target_period) ||
    !quarter(value.comparison_period) ||
    !nullableText(value.model_version) ||
    !Array.isArray(value.explanations) ||
    value.explanations.length > 3 ||
    !value.explanations.every(
      (item) =>
        object(item) &&
        text(item.feature) &&
        item.method === 'single_feature_reference_sensitivity' &&
        finite(item.observed_value) &&
        finite(item.reference_value) &&
        finite(item.delta_growth) &&
        (item.direction === undefined ||
          item.direction === 'positive' ||
          item.direction === 'negative'),
    )
  ) {
    return false
  }

  return (
    (value.status === 'available' &&
      finite(value.estimated_yoy_growth) &&
      value.estimated_yoy_growth >= -1 &&
      value.reason === null) ||
    (value.status === 'unavailable' && value.estimated_yoy_growth === null && text(value.reason))
  )
}

function isModelResult(value: unknown): value is AiModelResult {
  return (
    object(value) &&
    value.schema_version === '1.0' &&
    text(value.region_code) &&
    text(value.region_code_system) &&
    text(value.industry_code) &&
    value.source_kind === 'official' &&
    calendarDate(value.as_of) &&
    quarter(value.base_period) &&
    nullableText(value.model_version) &&
    text(value.policy_version) &&
    Array.isArray(value.warnings) &&
    value.warnings.length <= 32 &&
    value.warnings.every(text) &&
    isGrowth(value.growth) &&
    isIndicator(value.risk) &&
    isIndicator(value.fit)
  )
}

function isPeriodMetric(value: unknown, min: number, max: number): value is AiPeriodMetric {
  if (!object(value)) return false
  if (value.status === 'available') {
    return (
      quarter(value.basePeriod) &&
      finite(value.value) &&
      value.value >= min &&
      value.value <= max &&
      value.reason === null
    )
  }
  return (
    value.status === 'unavailable' &&
    (value.basePeriod === null || quarter(value.basePeriod)) &&
    value.value === null &&
    text(value.reason)
  )
}

function quarterIndex(period: string): number {
  return Number(period.slice(0, 4)) * 4 + Number(period[5]) - 1
}

const quarterEndSuffix = ['03-31', '06-30', '09-30', '12-31']

function isPeriodGrowth(value: unknown, asOf: string): boolean {
  if (!object(value)) return false
  const { targetPeriod, comparisonPeriod } = value
  if (!isPeriodMetric(value, -1, Infinity)) return false
  if (value.status === 'unavailable' && targetPeriod === null && comparisonPeriod === null) {
    return true
  }
  if (!value.basePeriod || !quarter(targetPeriod) || !quarter(comparisonPeriod)) {
    return false
  }

  const targetIndex = quarterIndex(targetPeriod)
  const targetEnd = `${targetPeriod.slice(0, 4)}-${quarterEndSuffix[targetIndex % 4]}`
  return (
    targetIndex === quarterIndex(value.basePeriod) + 1 &&
    quarterIndex(comparisonPeriod) === targetIndex - 4 &&
    (value.status === 'unavailable' || targetEnd > asOf)
  )
}

export function isAiAnalysisResponse(value: unknown): value is AiAnalysisResponse {
  if (
    !object(value) ||
    !object(value.request) ||
    typeof value.request.regionCode !== 'string' ||
    !/^\d{10}$/.test(value.request.regionCode) ||
    !text(value.request.industryCode) ||
    !calendarDate(value.asOf) ||
    !object(value.statistics) ||
    !text(value.statistics.version) ||
    !object(value.statistics.metrics) ||
    !Object.values(value.statistics.metrics).every(isMetric) ||
    !object(value.ai) ||
    (value.ai.state !== 'SKIPPED' &&
      value.ai.state !== 'FAILED' &&
      value.ai.state !== 'AVAILABLE') ||
    !nullableText(value.ai.transportStatus)
  ) {
    return false
  }

  if (value.schemaVersion === '2.0') {
    const { ai } = value
    return (
      !('basePeriod' in value) &&
      !('result' in ai) &&
      (ai.state === 'AVAILABLE' ? ai.reason === null : text(ai.reason)) &&
      object(ai.metrics) &&
      isPeriodGrowth(ai.metrics.growth, value.asOf) &&
      isPeriodMetric(ai.metrics.risk, 0, 100) &&
      isPeriodMetric(ai.metrics.fit, 0, 100) &&
      Array.isArray(ai.warnings) &&
      ai.warnings.length <= 32 &&
      ai.warnings.every(text)
    )
  }

  if (
    (value.schemaVersion !== undefined && value.schemaVersion !== '1.0') ||
    !quarter(value.basePeriod)
  ) {
    return false
  }

  if (value.ai.state === 'AVAILABLE') {
    return (
      value.ai.reason === null &&
      isModelResult(value.ai.result) &&
      value.ai.result.as_of === value.asOf &&
      value.ai.result.base_period === value.basePeriod
    )
  }

  return value.ai.result === null && text(value.ai.reason)
}

export function isAiAnalysisDisplay(value: unknown): value is AiAnalysisDisplay {
  return object(value) && text(value.requestId) && isAiAnalysisResponse(value)
}

function legacyMetric(
  basePeriod: string,
  value: number | null,
  reason: string | null,
): AiPeriodMetric {
  if (value !== null) return { status: 'available', basePeriod, value, reason: null }
  return { status: 'unavailable', basePeriod, value: null, reason: reason ?? 'invalid_ai_response' }
}

export function aiDisplayMetrics(
  data: AiAnalysisDisplay,
): (AiPeriodMetrics & { warnings: string[] }) | null {
  if (data.schemaVersion === '2.0') return { ...data.ai.metrics, warnings: data.ai.warnings }

  const result = data.ai.result
  if (!result) return null

  return {
    growth: {
      ...legacyMetric(result.base_period, result.growth.estimated_yoy_growth, result.growth.reason),
      targetPeriod: result.growth.target_period,
      comparisonPeriod: result.growth.comparison_period,
    },
    risk: legacyMetric(result.base_period, result.risk.score, result.risk.reason),
    fit: legacyMetric(result.base_period, result.fit.score, result.fit.reason),
    warnings: result.warnings,
  }
}

export function isAnalysisDisplayContext(value: unknown): value is AnalysisDisplayContext {
  return (
    object(value) &&
    text(value.regionName) &&
    text(value.industryName) &&
    Array.isArray(value.center) &&
    value.center.length === 2 &&
    finite(value.center[0]) &&
    finite(value.center[1]) &&
    Math.abs(value.center[0]) <= 90 &&
    Math.abs(value.center[1]) <= 180
  )
}

const reasonLabels: Record<string, string> = {
  mapping_unverified: '지역·업종 코드의 공식 대응을 확인하지 못했습니다.',
  mapping_scope_mismatch: '요청 지역·업종과 자료의 범위가 일치하지 않습니다.',
  mapping_not_available: '분석 기준일에 유효한 코드 대응 자료가 없습니다.',
  mapping_period_unverified: '자료 기간에 적용할 코드 대응을 확인하지 못했습니다.',
  insufficient_history: '필요한 분기 이력이 부족합니다.',
  missing_base_period: '기준 분기의 자료가 없습니다.',
  missing_sales: '사용할 수 있는 매출 자료가 없습니다.',
  source_not_approved: '자료의 사용 승인을 확인하지 못했습니다.',
  source_approval_time_unverified: '자료 승인 시점을 확인하지 못했습니다.',
  history_publication_unverified: '자료 공개 시점을 확인하지 못했습니다.',
  sales_unit_unverified: '매출 단위를 확인하지 못했습니다.',
  history_scope_mismatch: '분기 이력의 지역·업종이 요청과 다릅니다.',
  invalid_reviewed_history: '분기 이력을 검증하지 못했습니다.',
  ai_call_forbidden_in_transaction: '데이터 조회가 끝나지 않아 AI 요청을 보류했습니다.',
  ai_disabled: 'AI 분석 기능이 아직 활성화되지 않았습니다.',
  ai_authentication_failed: 'AI 서버 인증에 실패했습니다.',
  ai_request_rejected: 'AI 서버가 분석 입력을 받지 않았습니다.',
  ai_timeout: 'AI 서버의 응답 시간이 초과되었습니다.',
  ai_server_unavailable: 'AI 서버에 연결할 수 없습니다.',
  ai_transport_failure: 'AI 서버와 통신하지 못했습니다.',
  ai_response_invalid: 'AI 서버 응답을 검증하지 못했습니다.',
  ai_request_failed: 'AI 요청을 완료하지 못했습니다.',
  invalid_ai_response: 'AI 응답의 상태를 검증하지 못했습니다.',
  model_not_found: '사용 가능한 예측 모델 파일이 없습니다.',
  model_load_failed: '예측 모델을 불러오지 못했습니다.',
  unsupported_scope: '이 지역·업종 조합은 현재 모델의 지원 범위 밖입니다.',
  source_kind_mismatch: '자료 유형이 모델의 학습 자료와 다릅니다.',
  target_not_future: '예측 대상 분기가 분석 기준일보다 이후가 아닙니다.',
  prediction_out_of_bounds: '예측값이 허용 범위를 벗어났습니다.',
  model_inference_failed: '모델 계산 중 오류가 발생했습니다.',
  missing_risk_indicators: '위험 지수를 계산할 기초 지표가 부족합니다.',
  missing_fit_indicators: '업종 적합도 지수를 계산할 기초 지표가 부족합니다.',
  nonfinite_derived_indicator: '계산된 지표가 유효한 수치가 아닙니다.',
  invalid_sales_denominator: '매출 증가율의 비교 기준 매출이 유효하지 않습니다.',
  experimental_model_disabled: '시험용 예측 모델의 사용이 비활성화되었습니다.',
  model_information_after_as_of: '모델에 분석 기준일 이후의 정보가 포함되어 사용할 수 없습니다.',
}

export function aiReasonText(reason: string | null): string {
  if (!reason) return '제공 사유가 없습니다.'
  return Object.hasOwn(reasonLabels, reason) ? reasonLabels[reason] : `사유 코드: ${reason}`
}

export function aiWarningText(warning: string): string {
  const warnings: Record<string, string> = {
    draft_scoring_policy: '위험·적합도 지수는 검증 중인 초안입니다.',
    indices_are_not_probabilities: '지수는 창업 성공률이나 폐업 확률이 아닙니다.',
    risk_closure_ratio_uses_current_stock_not_official_closure_rate:
      '위험 지수의 폐업 비율은 공식 폐업률이 아닙니다.',
    fit_is_population_and_competition_only_not_validated_business_suitability:
      '적합도 지수는 인구와 경쟁 지표에 한정된 초안입니다.',
  }
  return Object.hasOwn(warnings, warning) ? warnings[warning] : warning
}

export function toAnalysis(
  request: AnalysisRequest,
  response: AiAnalysisResponse,
  requestId: string,
  context: AnalysisDisplayContext,
): Analysis {
  const state = response.ai.state
  const summary =
    response.schemaVersion === '2.0'
      ? '성장률과 초안 진단 지수의 기준 분기, 제공 상태와 사유를 지표별로 확인해 주세요.'
      : state === 'AVAILABLE'
        ? 'AI 응답을 받았습니다. 아래의 예측과 초안 진단 지수별 제공 상태를 확인해 주세요.'
        : state === 'SKIPPED'
          ? `검증된 분석 입력이 부족해 AI 요청을 보류했습니다. ${aiReasonText(response.ai.reason)}`
          : `AI 분석 결과를 제공할 수 없습니다. ${aiReasonText(response.ai.reason)}`

  return {
    id: `ai-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
    request: { ...request },
    regionName: context.regionName,
    industryName: context.industryName,
    period: response.schemaVersion === '2.0' ? null : response.basePeriod,
    analyzedAt: new Date().toISOString(),
    source: 'api',
    scores: { overall: null, growth: null, risk: null, fit: null },
    factors: [],
    trends: [],
    competition: [],
    map: { center: [...context.center], boundary: [], places: [] },
    summary,
    recommendations: [],
    ai: { ...response, requestId },
  }
}
