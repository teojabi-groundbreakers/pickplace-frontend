import { loadKakaoMaps } from './kakaoMaps'
import type { KakaoRegionResult } from './kakaoMaps'
import { lookupAdministrativeRegion } from './regionLookup'

export type ReferenceLocationErrorCode = 'NOT_FOUND' | 'MISMATCH' | 'SERVICE_ERROR' | 'TIMEOUT'

export class ReferenceLocationError extends Error {
  readonly code: ReferenceLocationErrorCode

  constructor(message: string, code: ReferenceLocationErrorCode) {
    super(message)
    this.name = 'ReferenceLocationError'
    this.code = code
  }
}

export type LocatedReferenceDong = {
  region: KakaoRegionResult
  center: [number, number]
  placeName: string
}

type PlaceCandidate = { place_name: string; x: string; y: string }
const SEARCH_TIMEOUT_MS = 20_000
const REGION_TIMEOUT_MS = 9_000
const MAX_CANDIDATES = 3

function abortError() {
  return new DOMException('위치 조회가 취소되었습니다.', 'AbortError')
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function findPlaces(
  places: {
    keywordSearch: (
      query: string,
      callback: (results: PlaceCandidate[], status: string) => void,
      options?: { size?: number },
    ) => void
  },
  query: string,
  signal: AbortSignal,
): Promise<PlaceCandidate[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }

    let settled = false
    const finish = (error?: Error, items: PlaceCandidate[] = []) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve(items)
    }
    const onAbort = () => finish(abortError())
    signal.addEventListener('abort', onAbort, { once: true })

    try {
      places.keywordSearch(
        query,
        (items, status) => {
          if (status === 'ZERO_RESULT') finish()
          else if (status !== 'OK' || !Array.isArray(items)) {
            finish(new ReferenceLocationError('위치 검색을 완료하지 못했어요.', 'SERVICE_ERROR'))
          } else finish(undefined, items.slice(0, MAX_CANDIDATES))
        },
        { size: MAX_CANDIDATES },
      )
    } catch {
      finish(new ReferenceLocationError('위치 검색을 완료하지 못했어요.', 'SERVICE_ERROR'))
    }
  })
}

function candidatePosition(candidate: PlaceCandidate): [number, number] | null {
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof candidate.place_name !== 'string' ||
    !candidate.place_name.trim() ||
    typeof candidate.x !== 'string' ||
    !candidate.x.trim() ||
    typeof candidate.y !== 'string' ||
    !candidate.y.trim()
  ) {
    return null
  }
  const longitude = Number(candidate.x)
  const latitude = Number(candidate.y)
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null
  }
  return [latitude, longitude]
}

/** Finds an actual place whose reverse-geocoded H region satisfies the caller's checks. */
async function findVerifiedPlace(
  province: string,
  district: string,
  queries: string[],
  matchesRegion: (region: KakaoRegionResult) => boolean,
  appKey: string,
  signal: AbortSignal,
): Promise<LocatedReferenceDong> {
  if (signal.aborted) throw abortError()

  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, SEARCH_TIMEOUT_MS)
  signal.addEventListener('abort', abort, { once: true })

  try {
    const maps = await abortable(loadKakaoMaps(appKey), controller.signal)
    if (controller.signal.aborted) throw abortError()
    if (!maps.services?.Places) {
      throw new ReferenceLocationError('위치 검색 서비스를 사용할 수 없어요.', 'SERVICE_ERROR')
    }
    const places = new maps.services.Places()
    const seen = new Set<string>()
    let hadCandidates = false
    let hadInvalidCandidate = false

    for (const query of queries) {
      const candidates = await findPlaces(places, query, controller.signal)
      hadCandidates ||= candidates.length > 0
      for (const candidate of candidates) {
        if (controller.signal.aborted) throw abortError()
        const position = candidatePosition(candidate)
        if (!position) {
          hadInvalidCandidate = true
          continue
        }
        const key = `${position[0]},${position[1]}`
        if (seen.has(key)) continue
        seen.add(key)
        let region: KakaoRegionResult | null
        const regionTimeout = AbortSignal.timeout(REGION_TIMEOUT_MS)
        const regionSignal = AbortSignal.any([controller.signal, regionTimeout])
        try {
          region = await abortable(
            lookupAdministrativeRegion(position, appKey, regionSignal),
            regionSignal,
          )
        } catch (error) {
          if (controller.signal.aborted) throw error
          if (regionTimeout.aborted) {
            throw new ReferenceLocationError('행정동 조회 시간이 초과됐어요.', 'TIMEOUT')
          }
          throw new ReferenceLocationError('행정동을 확인하지 못했어요.', 'SERVICE_ERROR')
        }
        if (
          region?.region_type === 'H' &&
          /^\d{10}$/.test(region.code) &&
          region.region_1depth_name === province &&
          region.region_2depth_name === district &&
          typeof region.region_3depth_name === 'string' &&
          region.region_3depth_name.trim() &&
          typeof region.address_name === 'string' &&
          region.address_name.trim() &&
          matchesRegion(region)
        ) {
          return { region, center: position, placeName: candidate.place_name.trim() }
        }
      }
    }
    if (hadInvalidCandidate) {
      throw new ReferenceLocationError('위치 검색 결과를 확인하지 못했어요.', 'SERVICE_ERROR')
    }
    if (hadCandidates) {
      throw new ReferenceLocationError('선택한 지역의 위치를 확인하지 못했어요.', 'MISMATCH')
    }
    throw new ReferenceLocationError('선택한 지역의 위치를 찾지 못했어요.', 'NOT_FOUND')
  } catch (error) {
    if (timedOut && !signal.aborted) {
      throw new ReferenceLocationError('위치 조회 시간이 초과됐어요.', 'TIMEOUT')
    }
    if (signal.aborted) throw abortError()
    if (error instanceof ReferenceLocationError) throw error
    throw new ReferenceLocationError('위치 검색 서비스를 사용할 수 없어요.', 'SERVICE_ERROR')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

/** Uses an independently verified, version-matched H10; names are only search terms. */
export function locateReferenceDong(
  districtName: string,
  dongName: string,
  expectedH10: string,
  officialName: string,
  appKey: string,
  signal: AbortSignal,
  provinceName = '서울특별시',
): Promise<LocatedReferenceDong> {
  const province = provinceName.trim()
  const district = districtName.trim()
  const dong = dongName.trim()
  if (!province || !district || !dong || !/^\d{10}$/.test(expectedH10)) {
    return Promise.reject(new ReferenceLocationError('선택한 지역을 확인해 주세요.', 'NOT_FOUND'))
  }
  const names = [...new Set([dong, officialName.trim()].filter(Boolean))]
  const queries = [
    ...names.map((name) => `${province} ${district} ${name} 주민센터`),
    ...names.map((name) => `${province} ${district} ${name}`),
  ]
  return findVerifiedPlace(
    province,
    district,
    queries,
    (region) => region.code === expectedH10,
    appKey,
    signal,
  )
}

/** Finds one verified place inside a district, not an administrative-dong selection. */
export function locateReferenceDistrict(
  districtName: string,
  appKey: string,
  signal: AbortSignal,
  provinceName = '서울특별시',
): Promise<LocatedReferenceDong> {
  const province = provinceName.trim()
  const district = districtName.trim()
  if (!province || !district) {
    return Promise.reject(new ReferenceLocationError('선택한 지역을 확인해 주세요.', 'NOT_FOUND'))
  }
  const queries = [`${province} ${district}청`, `${province} ${district}`]
  return findVerifiedPlace(province, district, queries, () => true, appKey, signal)
}
