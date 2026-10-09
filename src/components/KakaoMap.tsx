import { useEffect, useRef, useState } from 'react'
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react'
import type { MapRendererProps } from '../types/map'
import type { KakaoMap as KakaoMapInstance, KakaoMapsApi, KakaoMouseEvent } from '../lib/kakaoMaps'
import { loadKakaoMaps } from '../lib/kakaoMaps'
import { bindKakaoMapWheel } from '../lib/kakaoMapWheel'
import { mapSettings } from '../lib/mapProviders'

export function KakaoMap({
  data,
  regions,
  selectedRegionCode,
  disabled,
  onRegionSelect,
  onFailure,
  onPointSelect,
  lookupPoint,
  exploreRegion,
}: MapRendererProps) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<KakaoMapInstance | null>(null)
  const [api, setApi] = useState<KakaoMapsApi | null>(null)
  const initialCenter = useRef(data.center)
  const failure = useRef(onFailure)
  useEffect(() => {
    failure.current = onFailure
  }, [onFailure])
  useEffect(() => {
    let cancelled = false
    let observer: ResizeObserver | undefined
    let clearHealthCheck = () => {}
    let clearWheel = () => {}
    loadKakaoMaps(mapSettings.kakaoAppKey)
      .then((maps) => {
        if (cancelled || !container.current) return
        try {
          instance.current = new maps.Map(container.current, {
            center: new maps.LatLng(...initialCenter.current),
            level: 5,
            draggable: true,
            scrollwheel: true,
            disableDoubleClick: false,
            disableDoubleClickZoom: false,
          })
          const map = instance.current
          clearWheel = bindKakaoMapWheel(container.current, map, maps)
          let errors = 0
          let timer: ReturnType<typeof setTimeout>
          const beginLoad = () => {
            errors = 0
            clearTimeout(timer)
            timer = setTimeout(() => {
              if (!cancelled) failure.current()
            }, 12_000)
          }
          const finishLoad = () => clearTimeout(timer)
          const tileError = (event: Event) => {
            if (event.target instanceof HTMLImageElement && ++errors >= 3 && !cancelled)
              failure.current()
          }
          maps.event.addListener(map, 'bounds_changed', beginLoad)
          maps.event.addListener(map, 'tilesloaded', finishLoad)
          container.current.addEventListener('error', tileError, true)
          beginLoad()
          const element = container.current
          clearHealthCheck = () => {
            clearTimeout(timer)
            maps.event.removeListener(map, 'bounds_changed', beginLoad)
            maps.event.removeListener(map, 'tilesloaded', finishLoad)
            element.removeEventListener('error', tileError, true)
          }
          observer = new ResizeObserver(() => instance.current?.relayout())
          observer.observe(container.current)
          setApi(maps)
        } catch {
          failure.current()
        }
      })
      .catch(() => {
        if (!cancelled) failure.current()
      })
    const element = container.current
    return () => {
      cancelled = true
      clearHealthCheck()
      clearWheel()
      observer?.disconnect()
      instance.current = null
      element?.replaceChildren()
    }
  }, [])
  useEffect(() => {
    const map = instance.current
    if (!api || !map || !onPointSelect) return
    const selectPoint = (event: KakaoMouseEvent) => {
      onPointSelect([event.latLng.getLat(), event.latLng.getLng()])
    }
    api.event.addListener(map, 'rightclick', selectPoint)
    return () => api.event.removeListener(map, 'rightclick', selectPoint)
  }, [api, onPointSelect])
  useEffect(() => {
    const map = instance.current
    if (!api || !map) return
    const overlays: { setMap: (map: KakaoMapInstance | null) => void }[] = []
    try {
      if (data.boundary.length >= 3) {
        overlays.push(
          new api.Polygon({
            map,
            path: data.boundary.map((point) => new api.LatLng(...point)),
            strokeWeight: 2,
            strokeColor: '#62876c',
            strokeOpacity: 0.8,
            fillColor: '#8cac7d',
            fillOpacity: 0.12,
          }),
        )
      }
      for (const region of regions) {
        const button = document.createElement('button')
        button.className = `kakao-region-marker ${region.code === selectedRegionCode ? 'selected' : ''}`
        button.textContent = region.name
        button.setAttribute('aria-label', `${region.fullName} 선택`)
        button.setAttribute('aria-pressed', String(region.code === selectedRegionCode))
        button.disabled = disabled || false
        button.onclick = () => onRegionSelect(region.code)
        overlays.push(
          new api.CustomOverlay({
            map,
            content: button,
            clickable: true,
            position: new api.LatLng(...region.center),
            yAnchor: 0.5,
            zIndex: region.code === selectedRegionCode ? 5 : 2,
          }),
        )
      }
      const center = document.createElement('span')
      center.className = 'kakao-center-marker'
      center.setAttribute('aria-label', data.regionName)
      overlays.push(
        new api.CustomOverlay({
          map,
          content: center,
          clickable: false,
          position: new api.LatLng(...data.center),
          zIndex: 1,
        }),
      )
      for (const place of data.places) {
        const marker = document.createElement('button')
        marker.className = `kakao-place-marker place-${place.type}`
        marker.title = place.name
        marker.textContent = place.name
        overlays.push(
          new api.CustomOverlay({
            map,
            content: marker,
            clickable: true,
            position: new api.LatLng(...place.position),
            zIndex: 1,
          }),
        )
      }
      if (lookupPoint) {
        const point = document.createElement('span')
        point.className = 'kakao-lookup-marker'
        overlays.push(
          new api.CustomOverlay({
            map,
            content: point,
            clickable: false,
            position: new api.LatLng(...lookupPoint),
            zIndex: 6,
          }),
        )
      }
    } catch {
      failure.current()
    }
    return () => overlays.forEach((overlay) => overlay.setMap(null))
  }, [api, data, regions, selectedRegionCode, disabled, onRegionSelect, lookupPoint])
  useEffect(() => {
    const map = instance.current
    if (!api || !map) return
    try {
      if (exploreRegion) {
        map.setCenter(new api.LatLng(...exploreRegion.center))
        map.setLevel(Math.min(map.getLevel(), 3))
        return
      }
      if (data.boundary.length >= 3 || (!selectedRegionCode && regions.length > 1)) {
        const bounds = new api.LatLngBounds()
        const points =
          data.boundary.length >= 3 ? data.boundary : regions.map((region) => region.center)
        points.forEach((point) => bounds.extend(new api.LatLng(...point)))
        map.setBounds(bounds, 50, 50, 50, 50)
      } else {
        map.setCenter(new api.LatLng(...data.center))
        map.setLevel(5)
      }
    } catch {
      failure.current()
    }
  }, [api, data.center, data.boundary, regions, selectedRegionCode, exploreRegion])
  const recenter = () => {
    if (api) {
      instance.current?.setCenter(new api.LatLng(...data.center))
      instance.current?.setLevel(5)
    }
  }
  return (
    <>
      <div
        ref={container}
        className="area-map kakao-map"
        role="region"
        aria-label={`${data.regionName} 카카오지도`}
      />
      {!api && (
        <span
          className="map-sdk-loading"
          role="status"
        >
          카카오지도를 불러오고 있어요…
        </span>
      )}
      <div className="kakao-zoom">
        <button
          aria-label="지도 확대"
          onClick={() => {
            const map = instance.current
            if (map) map.setLevel(Math.max(1, map.getLevel() - 1))
          }}
        >
          <Plus size={16} />
        </button>
        <button
          aria-label="지도 축소"
          onClick={() => {
            const map = instance.current
            if (map) map.setLevel(Math.min(14, map.getLevel() + 1))
          }}
        >
          <Minus size={16} />
        </button>
      </div>
      <button
        type="button"
        className="map-recenter kakao-recenter"
        aria-label="선택 지역 중심으로 이동"
        onClick={recenter}
      >
        <LocateFixed size={17} />
      </button>
      {onPointSelect && (
        <button
          type="button"
          className="map-query-center"
          disabled={!api}
          onClick={() => {
            const point = instance.current?.getCenter()
            if (point) onPointSelect([point.getLat(), point.getLng()])
          }}
        >
          <MapPin size={16} />
          중심 위치 조회
        </button>
      )}
    </>
  )
}
