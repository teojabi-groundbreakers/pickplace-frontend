import { useEffect, useState } from 'react'
import type { AnalysisRequest } from '../types/analysis'

const fitPath = '/__ai-model-api/fit-reference'
export const fitComparisonError = '비교 지표를 불러오지 못했습니다.'

export interface FitMetric {
  value: number
  percentile: number | null
}

interface FitReference {
  referenceDate: string
  sourceIndustryName: string
  cohortSize: number | null
  residentsPerStore: FitMetric | null
  storesPerKm2: FitMetric | null
}

type FitReferenceResult =
  | { status: 'available'; reference: FitReference }
  | { status: 'unavailable'; reason: 'not_available' | 'boundary_unverified' }

export type FitReferenceState = FitReferenceResult | { status: 'idle' | 'loading' | 'error' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readMetric(value: unknown, unit: string): FitMetric | null | undefined {
  if (!isRecord(value) || value.unit !== unit) return undefined
  if (
    value.status === 'available' &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    value.value >= 0
  ) {
    const percentile = value.percentile
    return {
      value: value.value,
      percentile:
        typeof percentile === 'number' &&
        Number.isFinite(percentile) &&
        percentile >= 0 &&
        percentile <= 100
          ? percentile
          : null,
    }
  }
  if (value.status === 'unavailable' && value.value === null && typeof value.reason === 'string') {
    return null
  }
  return undefined
}

function readComparison(value: unknown, request: AnalysisRequest): FitReference | null {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.meta)) {
    throw new Error(fitComparisonError)
  }
  const { data, meta } = value
  const scope = meta.scope
  if (
    !isRecord(scope) ||
    scope.regionCode !== request.regionCode ||
    scope.industryCode !== request.industryCode ||
    typeof scope.sourceIndustryName !== 'string' ||
    !scope.sourceIndustryName.trim()
  ) {
    throw new Error(fitComparisonError)
  }

  const residentsPerStore = readMetric(data.residents_per_store, 'persons_per_store')
  const storesPerKm2 = readMetric(data.stores_per_km2, 'stores_per_km2')
  if (residentsPerStore === undefined || storesPerKm2 === undefined) {
    throw new Error(fitComparisonError)
  }
  if (residentsPerStore === null && storesPerKm2 === null) return null

  const referenceDate = data.reference_date
  if (typeof referenceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    throw new Error(fitComparisonError)
  }
  const date = new Date(`${referenceDate}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== referenceDate) {
    throw new Error(fitComparisonError)
  }
  return {
    referenceDate,
    sourceIndustryName: scope.sourceIndustryName,
    cohortSize:
      typeof data.cohort_size === 'number' &&
      Number.isSafeInteger(data.cohort_size) &&
      data.cohort_size > 0
        ? data.cohort_size
        : null,
    residentsPerStore,
    storesPerKm2,
  }
}

async function fetchComparison(
  request: AnalysisRequest,
  signal: AbortSignal,
): Promise<FitReferenceResult> {
  const query = new URLSearchParams({
    regionCode: request.regionCode,
    industryCode: request.industryCode,
  })
  const response = await fetch(`${fitPath}?${query}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  })
  const body: unknown = await response.json()
  if (response.status === 404 && isRecord(body)) {
    if (body.code === 'FIT_REFERENCE_BOUNDARY_UNVERIFIED') {
      return { status: 'unavailable', reason: 'boundary_unverified' }
    }
    if (body.code === 'FIT_REFERENCE_NOT_AVAILABLE') {
      return { status: 'unavailable', reason: 'not_available' }
    }
  }
  if (!response.ok) throw new Error(fitComparisonError)
  const reference = readComparison(body, request)
  return reference
    ? { status: 'available', reference }
    : { status: 'unavailable', reason: 'not_available' }
}

export function useFitReference(selection?: AnalysisRequest): FitReferenceState {
  const [result, setResult] = useState<{ key: string; state: FitReferenceState } | null>(null)
  const regionCode = selection?.regionCode
  const industryCode = selection?.industryCode
  const key = regionCode && industryCode ? `${regionCode}:${industryCode}` : null

  useEffect(() => {
    if (!key || !regionCode || !industryCode) return
    const controller = new AbortController()
    void fetchComparison({ regionCode, industryCode }, controller.signal)
      .then((state) => {
        if (controller.signal.aborted) return
        setResult({ key, state })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'error' } })
      })
    return () => controller.abort()
  }, [regionCode, industryCode, key])

  if (!key) return { status: 'idle' }
  return result?.key === key ? result.state : { status: 'loading' }
}
