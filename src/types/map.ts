import type { Analysis, IndustryCategory, Neighborhood } from './analysis'

export interface MapRegion extends Neighborhood {
  fullName: string
}

export interface RegionAnalysisOptions {
  categories: IndustryCategory[]
  industryCode: string
  onIndustryChange: (code: string) => void
  onAnalyze: (region: MapRegion, industryCode: string) => void
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
  exploreRegion?: MapRegion | null
}
