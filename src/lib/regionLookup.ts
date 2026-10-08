import { loadKakaoMaps } from './kakaoMaps'
import type { KakaoRegionResult } from './kakaoMaps'
import type { MapRegion } from '../types/map'

export function findSupportedRegion(regions: MapRegion[], code: string): MapRegion | null {
  // The demo catalog uses 8-digit administrative codes; Kakao returns 10 digits.
  const matches = regions.filter((region) => {
    const normalized = /^\d{8}$/.test(region.code) ? `${region.code}00` : region.code
    return normalized === code
  })
  return matches.length === 1 ? matches[0] : null
}

export function lookupAdministrativeRegion(
  point: [number, number],
  appKey: string,
  signal: AbortSignal,
): Promise<KakaoRegionResult | null> {
  if (!appKey.trim()) {
    return Promise.reject(new Error('행정구역 조회 설정이 필요해요. 지역 검색으로 선택해 주세요.'))
  }
  const [latitude, longitude] = point
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return Promise.reject(new Error('조회할 지도 좌표가 올바르지 않아요.'))
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (result: KakaoRegionResult | null, error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve(result)
    }
    const abort = () => finish(null, new DOMException('조회가 취소되었습니다.', 'AbortError'))
    const timer = setTimeout(
      () => finish(null, new Error('행정구역 조회가 지연되고 있어요. 다시 시도해 주세요.')),
      10_000,
    )
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
      return
    }

    loadKakaoMaps(appKey)
      .then((maps) => {
        if (settled) return
        if (!maps.services) {
          finish(null, new Error('행정구역 조회 서비스를 불러오지 못했어요. 새로고침해 주세요.'))
          return
        }
        const geocoder = new maps.services.Geocoder()
        geocoder.coord2RegionCode(longitude, latitude, (results, status) => {
          if (status === 'ZERO_RESULT') finish(null)
          else if (status !== 'OK') {
            finish(null, new Error('행정구역을 조회하지 못했어요. 연결 상태를 확인해 주세요.'))
          } else {
            const region = results.find((item) => item.region_type === 'H')
            if (region && (!/^\d{10}$/.test(region.code) || !region.address_name)) {
              finish(null, new Error('행정구역 조회 응답을 확인할 수 없어요. 다시 시도해 주세요.'))
            } else finish(region || null)
          }
        })
      })
      .catch(() =>
        finish(null, new Error('행정구역 조회 연결에 실패했어요. 지역 검색으로 선택해 주세요.')),
      )
  })
}
