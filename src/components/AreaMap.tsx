import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Layers, MapPin, RotateCcw, X } from 'lucide-react'
import {
  getMapProviders,
  initialMapProvider,
  mapSettings,
  nextMapProvider,
} from '../lib/mapProviders'
import { lookupAdministrativeRegion } from '../lib/regionLookup'
import type { KakaoRegionResult } from '../lib/kakaoMaps'
import type { MapProviderId } from '../lib/mapProviders'
import type { MapRegion, MapViewData, RegionAnalysisOptions } from '../types/map'
import type { MapPlace } from '../types/analysis'
import { LeafletMap } from './LeafletMap'
import { KakaoMap } from './KakaoMap'
import { RegionLookupActions } from './RegionLookupActions'

const layers = [
  { key: 'competitor' as const, label: '동종 점포', color: '#49755d' },
  { key: 'transport' as const, label: '교통', color: '#648caf' },
  { key: 'facility' as const, label: '주요 시설', color: '#bd9865' },
]

export function AreaMap({
  data,
  regions,
  selectedRegionCode,
  disabled,
  onRegionSelect,
  analysis,
  exploreRegion,
  onExploreRegion,
  children,
  onLookupStart,
}: {
  data: MapViewData
  regions: MapRegion[]
  selectedRegionCode: string
  disabled?: boolean
  onRegionSelect: (code: string) => void
  analysis: RegionAnalysisOptions
  exploreRegion?: MapRegion | null
  onExploreRegion: (region: MapRegion) => void
  children?: ReactNode
  onLookupStart?: () => void
}) {
  const request = useRef<AbortController | null>(null)
  const [lookup, setLookup] = useState<{
    point: [number, number]
    status: 'loading' | 'success' | 'empty' | 'error'
    region?: KakaoRegionResult
    message?: string
  } | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const queryPoint = useCallback(
    async (point: [number, number]) => {
      onLookupStart?.()
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      setLookup({ point, status: 'loading' })
      try {
        const region = await lookupAdministrativeRegion(
          point,
          mapSettings.kakaoAppKey,
          controller.signal,
        )
        if (!controller.signal.aborted) {
          setLookup(region ? { point, status: 'success', region } : { point, status: 'empty' })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLookup({
            point,
            status: 'error',
            message: error instanceof Error ? error.message : '행정구역 조회에 실패했어요.',
          })
        }
      }
    },
    [onLookupStart],
  )
  const providers = useMemo(() => getMapProviders(), [])
  const [source, setSource] = useState(() => ({
    provider: initialMapProvider(providers),
    failed: [] as MapProviderId[],
    recovery: null as { from: MapProviderId; to: MapProviderId } | null,
    attempt: 0,
  }))
  const [visible, setVisible] = useState<MapPlace['type'][]>([
    'competitor',
    'transport',
    'facility',
  ])

  const active = providers.find((provider) => provider.id === source.provider)!
  const filteredData = useMemo(
    () => ({ ...data, places: data.places.filter((place) => visible.includes(place.type)) }),
    [data, visible],
  )

  const handleFailure = useCallback(
    () =>
      setSource((current) => {
        if (current.provider !== active.id || current.provider === 'schematic') return current
        const failed = [...current.failed, current.provider]
        const next = nextMapProvider(providers, failed)
        return {
          ...current,
          provider: next,
          failed,
          recovery: { from: current.provider, to: next },
        }
      }),
    [active.id, providers],
  )

  const rendererProps = {
    data: filteredData,
    regions,
    selectedRegionCode,
    disabled,
    onRegionSelect,
    onFailure: handleFailure,
    onPointSelect: queryPoint,
    lookupPoint: lookup?.point,
    exploreRegion,
  }

  return (
    <section
      className="map-panel map-explorer map-canvas"
      aria-label="지역 탐색 지도"
    >
      <div className="map-provider-toolbar">
        <label className="map-provider-select">
          <Layers size={15} />
          <span className="sr-only">배경지도 선택</span>
          <select
            aria-label="배경지도 선택"
            value={source.provider}
            onChange={(event) =>
              setSource({
                provider: event.target.value as MapProviderId,
                failed: [],
                recovery: null,
                attempt: source.attempt + 1,
              })
            }
          >
            {providers.map((provider) => (
              <option
                key={provider.id}
                value={provider.id}
                disabled={!provider.available}
              >
                {provider.label}
                {!provider.available ? ' (설정 필요)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="map-stage">
        {active.id === 'kakao' ? (
          <KakaoMap
            key={`kakao-${source.attempt}`}
            {...rendererProps}
          />
        ) : (
          <LeafletMap
            key={`${active.id}-${source.attempt}`}
            {...rendererProps}
            provider={active}
          />
        )}
        <span className="map-label">
          {data.regionName}
          <small>
            {exploreRegion
              ? active.id === 'schematic'
                ? '기본 위치도에서는 실제 점포를 볼 수 없어요'
                : '주변 점포명과 시설을 지도에서 살펴보세요'
              : data.isDemo
                ? '분석 경계·시설 마커는 예시입니다'
                : '행정동 표시를 눌러 지역을 선택하세요'}
          </small>
        </span>
        {active.id === 'schematic' && (
          <span className="schematic-label">기본 위치도 · 실제 도로지도 아님</span>
        )}
      </div>
      {children}
      {lookup && (
        <section
          className="map-region-lookup"
          aria-label="행정구역 조회"
        >
          <div className="lookup-heading">
            <span>
              <MapPin size={16} />이 위치의 행정구역
            </span>
            <button
              type="button"
              aria-label="행정구역 조회 닫기"
              onClick={() => {
                request.current?.abort()
                setLookup(null)
              }}
            >
              <X size={17} />
            </button>
          </div>
          <div
            role="status"
            aria-live="polite"
          >
            {lookup.status === 'loading' && <p>행정동을 확인하고 있어요…</p>}
            {lookup.status === 'empty' && (
              <p>이 위치의 행정동을 찾지 못했어요. 다른 위치를 선택해 주세요.</p>
            )}
            {lookup.status === 'error' && <p>{lookup.message}</p>}
            {lookup.region && (
              <>
                <strong>{lookup.region.address_name}</strong>
                <p>행정동 코드 {lookup.region.code}</p>
              </>
            )}
          </div>
          <small>
            위도 {lookup.point[0].toFixed(5)} · 경도 {lookup.point[1].toFixed(5)}
          </small>
          {lookup.region && (
            <RegionLookupActions
              key={`${lookup.region.code}-${lookup.point.join(',')}`}
              region={{
                code: lookup.region.code,
                name: lookup.region.region_3depth_name,
                fullName: lookup.region.address_name,
                center: lookup.point,
              }}
              analysis={{
                ...analysis,
                onAnalyze: (region, industryCode) => {
                  analysis.onAnalyze(region, industryCode)
                  setLookup(null)
                },
              }}
              disabled={disabled}
              onExplore={(region) => {
                onExploreRegion(region)
                setLookup(null)
              }}
            />
          )}
          {lookup.status === 'error' && (
            <button
              type="button"
              onClick={() => void queryPoint(lookup.point)}
            >
              행정구역 다시 조회
            </button>
          )}
        </section>
      )}
      {source.recovery && (
        <div
          className="map-recovery"
          role="status"
        >
          <span>
            {providers.find((provider) => provider.id === source.recovery?.from)?.label} 연결이
            원활하지 않아 {active.label}로 전환했어요. 지역 선택과 분석은 계속할 수 있습니다.
          </span>
          <button
            onClick={() =>
              setSource((current) =>
                current.recovery
                  ? {
                      provider: current.recovery.from,
                      failed: [],
                      recovery: null,
                      attempt: current.attempt + 1,
                    }
                  : current,
              )
            }
          >
            <RotateCcw size={13} />
            다시 시도
          </button>
        </div>
      )}
      <div className="map-bottom">
        <span className="map-selection-hint">
          {data.places.length > 0
            ? '분석 지역의 시설 레이어'
            : '우클릭으로 행정동 조회 · 모바일에서는 중심 위치 조회'}
        </span>
        {data.places.length > 0 && (
          <div className="map-layers">
            {layers.map((layer) => (
              <button
                aria-pressed={visible.includes(layer.key)}
                onClick={() =>
                  setVisible((items) =>
                    items.includes(layer.key)
                      ? items.filter((item) => item !== layer.key)
                      : [...items, layer.key],
                  )
                }
                key={layer.key}
              >
                <i style={{ background: layer.color }} />
                {layer.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {regions.length > 0 && (
        <details className="map-region-drawer">
          <summary>표시된 행정동 {regions.length}곳</summary>
          <div
            className="map-region-list"
            aria-label="지도에 표시된 행정동"
          >
            {regions.map((region) => (
              <button
                key={region.code}
                disabled={disabled}
                aria-pressed={region.code === selectedRegionCode}
                onClick={() => onRegionSelect(region.code)}
              >
                {region.name}
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
