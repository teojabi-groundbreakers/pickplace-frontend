export interface Option {
  code: string
  name: string
}

export interface Neighborhood extends Option {
  center: [number, number]
}

export interface District extends Option {
  neighborhoods: Neighborhood[]
}

export interface City extends Option {
  districts: District[]
}

export interface IndustryCategory extends Option {
  industries: Option[]
}

export interface Catalog {
  cities: City[]
  categories: IndustryCategory[]
}

export interface AnalysisRequest {
  regionCode: string
  industryCode: string
}

export interface Score {
  value: number
  grade: string
  description: string
}

export interface ResearchPrediction {
  targetPeriod: string
  estimatedYoYGrowth: number | null
  reason: string | null
  status: 'available' | 'unavailable'
  estimateKind: 'completed_quarter_unobserved_estimate' | 'in_progress_or_future_quarter_estimate'
  warnings: string[]
  retrospectiveTest?: {
    targetPeriod: string
    rows: number
    maePp: number
    medianAbsoluteErrorPp: number
  } | null
}

export interface ResearchForecast {
  mode: 'experimental_research_only'
  method: 'model_inference' | 'precomputed_snapshot'
  basePeriod: string
  dataAsOf: string
  modelVersion: string
  inputValuesVerified: boolean
  regionScopeVerified: boolean
  predictions: ResearchPrediction[]
}

export interface TrendPoint {
  month: string
  sales: number | null
  population: number | null
  stores: number | null
  openings: number | null
  closures: number | null
  averageSales: number | null
}

export interface MapPlace {
  id: string
  name: string
  type: 'competitor' | 'transport' | 'facility'
  position: [number, number]
}

export interface Analysis {
  id: string
  request: AnalysisRequest
  regionName: string
  industryName: string
  period: string
  analyzedAt: string
  source: 'demo' | 'api'
  scores: { overall: Score | null; growth: Score | null; risk: Score | null; fit: Score | null }
  factors: { name: string; description: string; contribution: number }[]
  trends: TrendPoint[]
  competition: { name: string; local: number; average: number; unit: string }[]
  map: { center: [number, number]; boundary: [number, number][]; places: MapPlace[] }
  summary: string
  recommendations: string[]
  researchForecast?: ResearchForecast | null
}

export type DemoScenario = 'success' | 'empty' | 'error'
