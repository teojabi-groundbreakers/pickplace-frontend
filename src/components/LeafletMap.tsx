import { useEffect, useRef } from 'react'
import { divIcon } from 'leaflet'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet'
import { LocateFixed, MapPin } from 'lucide-react'
import type { MapRendererProps } from '../types/map'
import type { MapProvider } from '../lib/mapProviders'
import 'leaflet/dist/leaflet.css'

const colors = { competitor: '#49755d', transport: '#648caf', facility: '#bd9865' }

function Viewport({
  data,
  regions,
  selectedRegionCode,
  maxZoom,
  onPointSelect,
  exploreRegion,
}: Pick<
  MapRendererProps,
  'data' | 'regions' | 'selectedRegionCode' | 'onPointSelect' | 'exploreRegion'
> & {
  maxZoom: number
}) {
  const map = useMapEvents({
    contextmenu: (event) => onPointSelect?.([event.latlng.lat, event.latlng.lng]),
  })
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  useEffect(() => {
    if (exploreRegion)
      map.setView(exploreRegion.center, Math.min(Math.max(map.getZoom(), 17), maxZoom))
    else if (data.boundary.length >= 3)
      map.fitBounds(data.boundary, { padding: [50, 50], maxZoom: Math.min(15, maxZoom) })
    else if (!selectedRegionCode && regions.length > 1)
      map.fitBounds(
        regions.map((region) => region.center),
        { padding: [60, 60], maxZoom: Math.min(13, maxZoom) },
      )
    else map.setView(data.center, Math.min(14, maxZoom))
  }, [map, data.center, data.boundary, regions, selectedRegionCode, maxZoom, exploreRegion])
  return (
    <>
      <button
        type="button"
        className="map-recenter"
        aria-label="선택 지역 중심으로 이동"
        onClick={() => map.setView(data.center, Math.min(14, maxZoom))}
      >
        <LocateFixed size={17} />
      </button>
      {onPointSelect && (
        <button
          type="button"
          className="map-query-center"
          onClick={() => {
            const point = map.getCenter()
            onPointSelect([point.lat, point.lng])
          }}
        >
          <MapPin size={16} />
          중심 위치 조회
        </button>
      )}
    </>
  )
}

function ReliableTiles({ provider, onFailure }: { provider: MapProvider; onFailure: () => void }) {
  const counts = useRef({ loaded: 0, errors: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const settled = useRef(false)
  const onFailureRef = useRef(onFailure)
  useEffect(() => {
    onFailureRef.current = onFailure
  }, [onFailure])
  useEffect(() => {
    clearTimeout(timer.current)
    if (!settled.current) timer.current = setTimeout(() => onFailureRef.current(), 12_000)
    return () => clearTimeout(timer.current)
  }, [])
  return (
    <TileLayer
      url={provider.url!}
      attribution={provider.attribution}
      maxZoom={provider.maxZoom}
      keepBuffer={1}
      eventHandlers={{
        loading: () => {
          settled.current = false
          counts.current = { loaded: 0, errors: 0 }
          clearTimeout(timer.current)
          timer.current = setTimeout(() => onFailureRef.current(), 12_000)
        },
        tileload: () => {
          counts.current.loaded += 1
        },
        tileerror: () => {
          counts.current.errors += 1
        },
        load: () => {
          settled.current = true
          clearTimeout(timer.current)
          if (
            counts.current.errors >= 3 ||
            (counts.current.errors > 0 && counts.current.loaded === 0)
          )
            onFailureRef.current()
        },
      }}
    />
  )
}

export function LeafletMap({
  data,
  regions,
  selectedRegionCode,
  disabled,
  onRegionSelect,
  onFailure,
  provider,
  onPointSelect,
  lookupPoint,
  exploreRegion,
}: MapRendererProps & { provider: MapProvider }) {
  return (
    <MapContainer
      center={data.center}
      zoom={Math.min(14, provider.maxZoom)}
      maxZoom={provider.maxZoom}
      scrollWheelZoom={false}
      className={`area-map ${provider.id === 'schematic' ? 'schematic-map' : ''}`}
      aria-label={`${data.regionName} ${provider.label}`}
    >
      {provider.url && (
        <ReliableTiles
          provider={provider}
          onFailure={onFailure}
        />
      )}
      {data.boundary.length >= 3 && (
        <Polygon
          positions={data.boundary}
          pathOptions={{
            color: '#62876c',
            fillColor: '#8cac7d',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '5 5',
          }}
        />
      )}
      {regions.map((region) => (
        <Marker
          key={region.code}
          position={region.center}
          title={`${region.fullName} 선택`}
          alt={`${region.fullName} 선택`}
          keyboard={!disabled}
          icon={divIcon({
            className: `region-map-pin ${region.code === selectedRegionCode ? 'selected' : ''}`,
            html: '<span></span>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })}
          eventHandlers={{
            click: () => {
              if (!disabled) onRegionSelect(region.code)
            },
          }}
        >
          <Tooltip
            permanent
            direction="top"
            offset={[0, -10]}
            className={`region-tooltip ${region.code === selectedRegionCode ? 'selected' : ''}`}
          >
            {region.name}
          </Tooltip>
        </Marker>
      ))}
      {!regions.some((region) => region.code === selectedRegionCode) && (
        <CircleMarker
          center={data.center}
          radius={8}
          pathOptions={{ color: '#fff', fillColor: '#244c3a', fillOpacity: 1, weight: 3 }}
        >
          <Popup>
            {data.regionName}
            <br />
            선택 지역 중심
          </Popup>
        </CircleMarker>
      )}
      {data.places.map((place) => (
        <CircleMarker
          key={place.id}
          center={place.position}
          radius={6}
          pathOptions={{ color: '#fff', fillColor: colors[place.type], fillOpacity: 1, weight: 2 }}
        >
          <Popup>{place.name}</Popup>
        </CircleMarker>
      ))}
      {lookupPoint && (
        <CircleMarker
          center={lookupPoint}
          radius={10}
          pathOptions={{ color: '#315b43', fillColor: '#fff', fillOpacity: 0.9, weight: 3 }}
        />
      )}
      <Viewport
        data={data}
        regions={regions}
        selectedRegionCode={selectedRegionCode}
        maxZoom={provider.maxZoom}
        onPointSelect={onPointSelect}
        exploreRegion={exploreRegion}
      />
    </MapContainer>
  )
}
