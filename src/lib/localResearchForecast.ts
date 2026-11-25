import type { AnalysisRequest, ResearchForecast } from '../types/analysis'
import { isResearchForecast } from './validation'

const forecastPath = '/__ai-model-api/research/forecast'
const requestTimeoutMs = 20_000
const forecastError = '연구 모델 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
const researchIndustries = new Set(['I21201', 'I21007', 'I21001'])

export function supportsLocalResearch(request: AnalysisRequest) {
  return /^11\d{8}$/.test(request.regionCode) && researchIndustries.has(request.industryCode)
}

export type LocalResearchResult =
  | { status: 'unavailable' }
  | { status: 'available'; forecast: ResearchForecast; scopeLabel: string }

export type LocalResearchState = LocalResearchResult | { status: 'idle' | 'loading' | 'error' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readForecast(data: unknown, scope: Record<string, unknown>): ResearchForecast | null {
  if (
    !isRecord(data) ||
    data.mode !== 'experimental_research_only' ||
    data.region_code_system !== 'seoul-adstrd' ||
    data.region_code !== scope.sourceRegionCode ||
    data.industry_code !== scope.sourceIndustryCode ||
    data.base_period !== '2026Q2' ||
    data.target_period !== '2026Q4' ||
    data.comparison_period !== '2025Q4' ||
    typeof data.model_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(data.model_sha256) ||
    data.input_values_verified !== false ||
    data.region_scope_verified !== false
  ) {
    return null
  }

  const retrospective = data.retrospective_test
  if (
    retrospective != null &&
    (!isRecord(retrospective) || retrospective.target_period !== data.comparison_period)
  ) {
    return null
  }

  const forecast = {
    mode: data.mode,
    method: 'model_inference',
    basePeriod: data.base_period,
    dataAsOf: data.snapshot_available_at,
    modelVersion: data.model_sha256,
    inputValuesVerified: data.input_values_verified,
    regionScopeVerified: data.region_scope_verified,
    predictions: [
      {
        status: data.status,
        targetPeriod: data.target_period,
        estimateKind: data.estimate_kind,
        estimatedYoYGrowth: data.estimated_yoy_growth,
        reason: data.reason,
        warnings: data.warnings,
        retrospectiveTest: retrospective
          ? {
              targetPeriod: retrospective.target_period,
              rows: retrospective.rows,
              maePp: retrospective.mae_pp,
              medianAbsoluteErrorPp: retrospective.median_absolute_error_pp,
            }
          : null,
      },
    ],
  }

  return isResearchForecast(forecast) ? forecast : null
}

export async function getLocalResearchForecast(
  request: AnalysisRequest,
  signal: AbortSignal,
): Promise<LocalResearchResult> {
  signal.throwIfAborted()
  const timeout = AbortSignal.timeout(requestTimeoutMs)
  const requestSignal = AbortSignal.any([signal, timeout])
  const query = new URLSearchParams({
    regionCode: request.regionCode,
    industryCode: request.industryCode,
  })

  try {
    const response = await fetch(`${forecastPath}?${query}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: requestSignal,
    })
    requestSignal.throwIfAborted()
    const envelope: unknown = await response.json()
    requestSignal.throwIfAborted()
    if (
      response.status === 404 &&
      isRecord(envelope) &&
      envelope.code === 'RESEARCH_SCOPE_NOT_AVAILABLE'
    ) {
      return { status: 'unavailable' }
    }
    if (!response.ok) throw new Error(forecastError)
    if (!isRecord(envelope) || !isRecord(envelope.meta)) throw new Error(forecastError)

    const { requestId } = envelope.meta
    if (
      typeof requestId !== 'string' ||
      !requestId.trim() ||
      response.headers.get('X-Request-Id') !== requestId
    ) {
      throw new Error(forecastError)
    }

    const scope = envelope.meta.scope
    if (
      !isRecord(scope) ||
      scope.regionCode !== request.regionCode ||
      scope.industryCode !== request.industryCode ||
      typeof scope.regionName !== 'string' ||
      !scope.regionName.trim() ||
      typeof scope.sourceRegionCode !== 'string' ||
      !/^11\d{6}$/.test(scope.sourceRegionCode) ||
      typeof scope.sourceIndustryCode !== 'string' ||
      !/^CS\d{6}$/.test(scope.sourceIndustryCode) ||
      typeof scope.sourceIndustryName !== 'string' ||
      !scope.sourceIndustryName.trim()
    ) {
      throw new Error(forecastError)
    }
    const forecast = readForecast(envelope.data, scope)
    if (!forecast) throw new Error(forecastError)
    return {
      status: 'available',
      forecast,
      scopeLabel: `${scope.regionName} · 서울 원천 ${scope.sourceIndustryName} 기준 (${scope.sourceIndustryCode})`,
    }
  } catch {
    signal.throwIfAborted()
    if (timeout.aborted) throw new Error('연구 모델 응답 시간이 초과되었어요.')
    throw new Error(forecastError)
  }
}
