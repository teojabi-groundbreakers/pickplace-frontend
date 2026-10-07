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

export interface TrendPoint {
  month: string
  sales: number
  population: number
  stores: number
  openings: number
  closures: number
  averageSales: number
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
  scores: { overall: Score; growth: Score; risk: Score; fit: Score }
  factors: { name: string; description: string; contribution: number }[]
  trends: TrendPoint[]
  competition: { name: string; local: number; average: number; unit: string }[]
  map: { center: [number, number]; boundary: [number, number][]; places: MapPlace[] }
  summary: string
  recommendations: string[]
}

export type DemoScenario = 'success' | 'empty' | 'error'
