import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MapPin, RotateCcw, X } from 'lucide-react'
import { config } from '../lib/config'
import { lookupAdministrativeRegion } from '../lib/regionLookup'
import { useRegionBoundary } from '../lib/useRegionBoundary'
import { isAdministrativeRegionCode } from '../lib/regionBoundary'
import type { KakaoRegionResult } from '../lib/kakaoMaps'
import type { RegionBoundary } from '../types/boundary'
import type { MapRegion, MapViewData, RegionAnalysisOptions } from '../types/map'
import type { MapPlace } from '../types/analysis'
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
  const lookupContext = useMemo(
    () => ({ selectedRegionCode, regions, exploreCode: exploreRegion?.code }),
    [selectedRegionCode, regions, exploreRegion?.code],
  )
  const [lookupState, setLookupState] = useState<{
    context: typeof lookupContext
    point: [number, number]
    status: 'loading' | 'success' | 'empty' | 'error'
    region?: KakaoRegionResult
    message?: string
  } | null>(null)
  const lookup = lookupState?.context === lookupContext ? lookupState : null
  useEffect(() => () => request.current?.abort(), [])
  const closeLookup = useCallback(() => {
    request.current?.abort()
    setLookupState(null)
  }, [])

  useEffect(() => {
    request.current?.abort()
  }, [lookupContext])

  const boundaryCode = lookup ? lookup.region?.code || '' : exploreRegion ? '' : selectedRegionCode
  const { state: boundaryState, retry: retryBoundary } = useRegionBoundary(boundaryCode)
  const administrativeBoundary =
    boundaryState.status === 'success' && boundaryState.regionCode === boundaryCode
      ? boundaryState.boundary
      : null
  const [failedBoundary, setFailedBoundary] = useState<RegionBoundary | null>(null)
  const boundaryRenderFailed =
    administrativeBoundary !== null && failedBoundary === administrativeBoundary
  const handleBoundaryFailure = useCallback(() => {
    if (administrativeBoundary) setFailedBoundary(administrativeBoundary)
  }, [administrativeBoundary])

  const showDemoBoundaryNotice =
    config.demoMode &&
    boundaryState.status === 'idle' &&
    !lookup &&
    !exploreRegion &&
    Boolean(selectedRegionCode)
  const showBoundaryStatus =
    showDemoBoundaryNotice ||
    (boundaryState.regionCode === boundaryCode && boundaryState.status !== 'idle')
  const boundaryStatus = showBoundaryStatus ? (
    <div
      className="map-boundary-status"
      aria-label="행정동 경계 상태"
      role={boundaryState.status === 'error' || boundaryRenderFailed ? 'alert' : 'status'}
      aria-live="polite"
    >
      {boundaryState.status === 'loading' && <p>행정동 경계를 불러오고 있어요…</p>}
      {administrativeBoundary && !boundaryRenderFailed && (
        <p>
          경계 기준일 {administrativeBoundary.boundaryDate}
          <br />
          출처{' '}
          <a
            href={administrativeBoundary.source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {administrativeBoundary.source.name}
          </a>
        </p>
      )}
      {(boundaryState.status === 'empty' || showDemoBoundaryNotice) && (
        <p>
          {config.demoMode
            ? '데모에서는 실제 행정동 경계를 제공하지 않아요.'
            : '이 지역의 경계 데이터가 아직 없어요.'}
        </p>
      )}
      {(boundaryState.status === 'error' || boundaryRenderFailed) && (
        <>
          <p>
            {boundaryRenderFailed
              ? '행정동 경계를 표시하지 못했어요. 다시 조회해 주세요.'
              : boundaryState.status === 'error'
                ? boundaryState.message
                : ''}
          </p>
          <button
            type="button"
            onClick={() => {
              setFailedBoundary(null)
              retryBoundary()
            }}
          >
            경계 다시 조회
          </button>
        </>
      )}
    </div>
  ) : null

  const queryPoint = useCallback(
    async (point: [number, number]) => {
      onLookupStart?.()
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      setLookupState({ context: lookupContext, point, status: 'loading' })
      try {
        const region = await lookupAdministrativeRegion(
          point,
          config.kakaoMapAppKey,
          controller.signal,
        )
        if (!controller.signal.aborted) {
          setLookupState({
            context: lookupContext,
            point,
            status: region ? 'success' : 'empty',
            region: region || undefined,
          })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLookupState({
            context: lookupContext,
            point,
            status: 'error',
            message: error instanceof Error ? error.message : '행정구역 조회에 실패했어요.',
          })
        }
      }
    },
    [onLookupStart, lookupContext],
  )
  const [mapFailed, setMapFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [visible, setVisible] = useState<MapPlace['type'][]>([
    'competitor',
    'transport',
    'facility',
  ])

  const filteredData = useMemo(
    () => ({ ...data, places: data.places.filter((place) => visible.includes(place.type)) }),
    [data, visible],
  )

  const handleFailure = useCallback(() => setMapFailed(true), [])

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
    administrativeBoundary: boundaryRenderFailed ? null : administrativeBoundary,
    hideAnalysisBoundary:
      Boolean(lookup || exploreRegion) || isAdministrativeRegionCode(boundaryCode),
    onBoundaryFailure: handleBoundaryFailure,
  }

  return (
    <section
      className="map-panel map-explorer map-canvas"
      aria-label="지역 탐색 지도"
    >
      <div className="map-stage">
        {mapFailed ? (
          <div
            className="map-unavailable"
            role="alert"
          >
            <strong>카카오지도를 불러오지 못했어요.</strong>
            <p>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>
          </div>
        ) : (
          <KakaoMap
            key={attempt}
            {...rendererProps}
          />
        )}
        {!mapFailed && (
          <div className="map-label">
            {data.regionName}
            <small>
              {exploreRegion
                ? '주변 점포명과 시설을 지도에서 살펴보세요'
                : data.isDemo
                  ? '분석 경계·시설 마커는 예시입니다'
                  : '행정동 표시를 눌러 지역을 선택하세요'}
            </small>
            {!lookup && boundaryStatus}
          </div>
        )}
      </div>
      {mapFailed && (
        <button
          type="button"
          className="map-query-center map-retry"
          onClick={() => {
            setMapFailed(false)
            setAttempt((value) => value + 1)
          }}
        >
          <RotateCcw size={15} />
          카카오지도 다시 시도
        </button>
      )}
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
              onClick={closeLookup}
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
          {boundaryStatus}
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
                  closeLookup()
                },
              }}
              disabled={disabled}
              onExplore={(region) => {
                onExploreRegion(region)
                closeLookup()
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
