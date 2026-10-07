// The browser JavaScript key is public; restrict allowed domains in Kakao Developers.
export interface KakaoLatLng {
  getLat(): number
  getLng(): number
}
export interface KakaoBounds {
  extend(point: KakaoLatLng): void
}
export interface KakaoMap {
  setCenter(point: KakaoLatLng): void
  setLevel(level: number): void
  getLevel(): number
  setBounds(bounds: KakaoBounds, top?: number, right?: number, bottom?: number, left?: number): void
  relayout(): void
}
interface KakaoLayer {
  setMap(map: KakaoMap | null): void
}
export interface KakaoMapsApi {
  load(callback: () => void): void
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoBounds
  Map: new (
    element: HTMLElement,
    options: { center: KakaoLatLng; level: number; scrollwheel: boolean },
  ) => KakaoMap
  CustomOverlay: new (options: {
    map: KakaoMap
    position: KakaoLatLng
    content: HTMLElement
    clickable: boolean
    yAnchor?: number
    zIndex?: number
  }) => KakaoLayer
  Polygon: new (options: {
    map: KakaoMap
    path: KakaoLatLng[]
    strokeWeight: number
    strokeColor: string
    strokeOpacity: number
    fillColor: string
    fillOpacity: number
  }) => KakaoLayer
  event: {
    addListener(target: KakaoMap, type: string, callback: () => void): void
    removeListener(target: KakaoMap, type: string, callback: () => void): void
  }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi }
  }
}
let pending: Promise<KakaoMapsApi> | null = null

export function loadKakaoMaps(appKey: string): Promise<KakaoMapsApi> {
  if (!appKey.trim()) return Promise.reject(new Error('카카오지도 앱 키가 없습니다.'))
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps)
  if (pending) return pending
  pending = new Promise<KakaoMapsApi>((resolve, reject) => {
    const script = document.createElement('script')
    let settled = false
    const finish = (maps?: KakaoMapsApi) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      script.onload = null
      script.onerror = null
      if (maps?.Map) resolve(maps)
      else {
        script.remove()
        reject(new Error('카카오지도를 불러오지 못했습니다.'))
      }
    }
    const timer = setTimeout(() => finish(), 10_000)
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`
    script.async = true
    script.onload = () => {
      if (!window.kakao?.maps?.load) {
        finish()
        return
      }
      try {
        window.kakao.maps.load(() => finish(window.kakao?.maps))
      } catch {
        finish()
      }
    }
    script.onerror = () => finish()
    document.head.append(script)
  }).catch((error) => {
    pending = null
    throw error
  })
  return pending
}
