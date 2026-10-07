import { useCallback, useMemo, useState } from 'react'
import { Layers, RotateCcw } from 'lucide-react'
import { getMapProviders, initialMapProvider, nextMapProvider } from '../lib/mapProviders'
import type { MapProviderId } from '../lib/mapProviders'
import type { MapRegion, MapViewData } from '../types/map'
import type { MapPlace } from '../types/analysis'
import { LeafletMap } from './LeafletMap'
import { KakaoMap } from './KakaoMap'

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
}: {
  data: MapViewData
  regions: MapRegion[]
  selectedRegionCode: string
  disabled?: boolean
  onRegionSelect: (code: string) => void
}) {
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
  }

  return (
    <section
      className="panel map-panel map-explorer"
      aria-label="지역 탐색 지도"
    >
      <div className="panel-header">
        <div className="map-explorer-title">
          <span className="step-chip">01</span>
          <h2>지도에서 시작해 보세요</h2>
        </div>
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
            {data.isDemo
              ? '분석 경계·시설 마커는 예시입니다'
              : '행정동 표시를 눌러 지역을 선택하세요'}
          </small>
        </span>
        {active.id === 'schematic' && (
          <span className="schematic-label">기본 위치도 · 실제 도로지도 아님</span>
        )}
      </div>
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
            : '행정동 표시를 눌러 분석할 지역을 선택하세요.'}
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
      )}
    </section>
  )
}
