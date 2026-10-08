import type { Analysis, Neighborhood } from './analysis'

export interface MapRegion extends Neighborhood {
  fullName: string
}

export interface MapViewData {
  center: [number, number]
  boundary: Analysis['map']['boundary']
  places: Analysis['map']['places']
  regionName: string
  isDemo: boolean
}

export interface MapRendererProps {
  data: MapViewData
  regions: MapRegion[]
  selectedRegionCode: string
  disabled?: boolean
  onRegionSelect: (code: string) => void
  onFailure: () => void
  onPointSelect?: (point: [number, number]) => void
  lookupPoint?: [number, number]
}
