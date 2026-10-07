export type MapProviderId = 'kakao' | 'custom' | 'osm' | 'schematic'
export interface MapSettings {
  preferred: string
  kakaoAppKey: string
  tileUrl: string
  tileAttribution: string
  maxZoom: number
}
export interface MapProvider {
  id: MapProviderId
  label: string
  available: boolean
  url?: string
  attribution?: string
  maxZoom: number
}

export const mapSettings: MapSettings = {
  preferred: import.meta.env.VITE_MAP_PROVIDER || 'auto',
  kakaoAppKey: import.meta.env.VITE_KAKAO_MAP_APP_KEY || '',
  tileUrl: import.meta.env.VITE_MAP_TILE_URL || '',
  tileAttribution: import.meta.env.VITE_MAP_ATTRIBUTION || '',
  maxZoom: Number(import.meta.env.VITE_MAP_MAX_ZOOM) || 19,
}

// Custom sources must be browser-usable Web Mercator XYZ raster tiles.
export function getMapProviders(settings: MapSettings = mapSettings): MapProvider[] {
  const validUrl =
    /^(https:\/\/|\/(?!\/))/.test(settings.tileUrl) &&
    ['{z}', '{x}', '{y}'].every((token) => settings.tileUrl.includes(token))
  return [
    {
      id: 'kakao',
      label: '카카오지도',
      available: Boolean(settings.kakaoAppKey.trim()),
      maxZoom: 19,
    },
    {
      id: 'custom',
      label: '대체 배경지도',
      available: validUrl && Boolean(settings.tileAttribution.trim()),
      url: settings.tileUrl,
      attribution: settings.tileAttribution,
      maxZoom: Math.min(22, Math.max(1, settings.maxZoom)),
    },
    {
      id: 'osm',
      label: 'OpenStreetMap',
      available: true,
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    { id: 'schematic', label: '기본 위치도', available: true, maxZoom: 19 },
  ]
}

export function initialMapProvider(
  providers: MapProvider[],
  preferred = mapSettings.preferred,
): MapProviderId {
  if (preferred !== 'auto')
    return (
      providers.find((provider) => provider.id === preferred && provider.available)?.id ||
      'schematic'
    )
  return providers.find((provider) => provider.available)?.id || 'schematic'
}

export function nextMapProvider(providers: MapProvider[], failed: MapProviderId[]): MapProviderId {
  // OSM is never an implicit fallback: operators who chose another source may be avoiding OSM.
  return (
    providers.find(
      (provider) => provider.available && provider.id !== 'osm' && !failed.includes(provider.id),
    )?.id || 'schematic'
  )
}
