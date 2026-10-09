import type { Analysis, AnalysisRequest, Catalog, DemoScenario } from '../types/analysis'
import { createDemoAnalysis, demoCatalog } from '../data/demo'
import { config } from './config'
import { isAnalysis, isCatalog } from './validation'
import { catalogRegions } from './catalogRegions'
import { findSupportedRegion } from './regionLookup'

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status = 0, code = 'REQUEST_FAILED') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function requestJson<T>(
  path: string,
  validate: (value: unknown) => value is T,
  options: RequestInit = {},
): Promise<T> {
  try {
    const timeout = AbortSignal.timeout(config.requestTimeout)
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    })
    const body: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      const code =
        body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
          ? body.code
          : 'REQUEST_FAILED'
      throw new ApiError(
        code === 'INSUFFICIENT_DATA'
          ? '분석할 데이터가 충분하지 않습니다.'
          : `서버가 요청을 처리하지 못했습니다. (${response.status})`,
        response.status,
        code,
      )
    }

    if (!validate(body)) {
      throw new ApiError('서버 응답 형식을 확인해 주세요.', response.status, 'INVALID_RESPONSE')
    }

    return body
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (options.signal?.aborted) throw error
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.', 0, 'TIMEOUT')
    }

    throw new ApiError(
      '서버에 연결할 수 없습니다. 네트워크 연결을 확인해 주세요.',
      0,
      'NETWORK_ERROR',
    )
  }
}

export async function getCatalog(signal?: AbortSignal): Promise<Catalog> {
  if (config.demoMode) return demoCatalog
  return requestJson('/catalog', isCatalog, { signal })
}

export async function analyze(
  request: AnalysisRequest,
  signal?: AbortSignal,
  scenario: DemoScenario = 'success',
): Promise<Analysis> {
  if (config.demoMode) {
    await new Promise<void>((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer)
        reject(new DOMException('취소된 요청입니다.', 'AbortError'))
      }

      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', cancel)
        resolve()
      }, 900)

      if (signal?.aborted) cancel()
      else signal?.addEventListener('abort', cancel, { once: true })
    })

    if (scenario === 'empty') {
      throw new ApiError('분석 가능한 표본이 부족합니다.', 422, 'INSUFFICIENT_DATA')
    }

    if (scenario === 'error') {
      throw new ApiError('일시적으로 분석 서버에 연결할 수 없습니다.', 503, 'SERVER_ERROR')
    }

    const region = findSupportedRegion(
      catalogRegions(demoCatalog),
      /^\d{8}$/.test(request.regionCode) ? `${request.regionCode}00` : request.regionCode,
    )
    if (!region) {
      throw new ApiError(
        '이 지역은 데모 분석 데이터가 없습니다. 실제 분석은 백엔드 연결 후 사용할 수 있어요.',
        422,
        'INSUFFICIENT_DATA',
      )
    }
    const result = createDemoAnalysis({ ...request, regionCode: region.code })
    return { ...result, request: { ...request } }
  }

  const result = await requestJson('/analyses', isAnalysis, {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  })

  if (
    result.request.regionCode !== request.regionCode ||
    result.request.industryCode !== request.industryCode
  ) {
    throw new ApiError('요청 조건과 분석 결과가 일치하지 않습니다.', 200, 'INVALID_RESPONSE')
  }

  return { ...result, source: 'api' }
}
