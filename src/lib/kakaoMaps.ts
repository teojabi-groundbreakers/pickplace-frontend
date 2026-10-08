// The browser JavaScript key is public; restrict allowed domains in Kakao Developers.
export interface KakaoLatLng {
  getLat(): number
  getLng(): number
}
export interface KakaoBounds {
  extend(point: KakaoLatLng): void
}
interface KakaoPoint {
  x: number
  y: number
}
export interface KakaoMap {
  getCenter(): KakaoLatLng
  setCenter(point: KakaoLatLng): void
  setLevel(level: number, options?: { anchor: KakaoLatLng }): void
  getLevel(): number
  getProjection(): {
    coordsFromContainerPoint(point: KakaoPoint): KakaoLatLng
  }
  setBounds(bounds: KakaoBounds, top?: number, right?: number, bottom?: number, left?: number): void
  relayout(): void
}
export interface KakaoRegionResult {
  region_type: 'H' | 'B'
  code: string
  address_name: string
  region_1depth_name: string
  region_2depth_name: string
  region_3depth_name: string
}

export interface KakaoMouseEvent {
  latLng: KakaoLatLng
}
interface KakaoLayer {
  setMap(map: KakaoMap | null): void
}

interface KakaoMapOptions {
  center: KakaoLatLng
  level: number
  draggable: boolean
  scrollwheel: boolean
  disableDoubleClick: boolean
  disableDoubleClickZoom: boolean
}

export interface KakaoMapsApi {
  load(callback: () => void): void
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  Point: new (x: number, y: number) => KakaoPoint
  LatLngBounds: new () => KakaoBounds
  Map: new (element: HTMLElement, options: KakaoMapOptions) => KakaoMap
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
    addListener(target: KakaoMap, type: string, callback: (event: KakaoMouseEvent) => void): void
    removeListener(target: KakaoMap, type: string, callback: (event: KakaoMouseEvent) => void): void
  }
  services?: {
    Geocoder: new () => {
      coord2RegionCode(
        longitude: number,
        latitude: number,
        callback: (results: KakaoRegionResult[], status: string) => void,
      ): void
    }
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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`
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
