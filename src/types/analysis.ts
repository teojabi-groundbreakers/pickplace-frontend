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

export interface AnalysisDisplayContext {
  regionName: string
  industryName: string
  center: [number, number]
}

export interface AiMetricDecision {
  value: number | null
  status: 'AVAILABLE' | 'NO_DATA' | 'UNAVAILABLE'
  reasonCode: string | null
}

export interface RegionalSummaryMetric extends AiMetricDecision {
  unit: 'PERSON' | 'STORE'
  source: { datasetCode: string; referenceOn: string }
}

export interface RegionalSummary {
  data: {
    region: { regionCode: string }
    businessType: { businessTypeCode: string }
    metrics: {
      registeredPopulation: RegionalSummaryMetric
      listedStoreCount: RegionalSummaryMetric
    }
  }
  meta: { requestId: string; referenceMonth: string }
}

export interface AiIndicator {
  status: 'available' | 'unavailable'
  reason: string | null
  score: number | null
  policy_status: string
  components: { name: string; value: number; unit: string; contribution_points: number }[]
}

export interface AiGrowth {
  status: 'available' | 'unavailable'
  reason: string | null
  estimated_yoy_growth: number | null
  target_period: string
  comparison_period: string
  model_version: string | null
  explanations: {
    feature: string
    method: string
    observed_value: number
    reference_value: number
    delta_growth: number
    direction?: 'positive' | 'negative'
  }[]
}

export interface AiModelResult {
  schema_version: '1.0'
  region_code: string
  region_code_system: string
  industry_code: string
  source_kind: 'official'
  as_of: string
  base_period: string
  model_version: string | null
  policy_version: string
  warnings: string[]
  growth: AiGrowth
  risk: AiIndicator
  fit: AiIndicator
}

interface AiAnalysisResponseBase {
  request: AnalysisRequest
  asOf: string
  statistics: {
    version: string
    metrics: Record<string, AiMetricDecision>
  }
}

interface AiAnalysisState {
  state: 'SKIPPED' | 'FAILED' | 'AVAILABLE'
  reason: string | null
  transportStatus: string | null
}

export interface AiAnalysisV1Response extends AiAnalysisResponseBase {
  schemaVersion?: '1.0'
  basePeriod: string
  ai: AiAnalysisState & { result: AiModelResult | null }
}

export type AiPeriodMetric =
  | { status: 'available'; basePeriod: string; value: number; reason: null }
  | { status: 'unavailable'; basePeriod: string | null; value: null; reason: string }

export type AiPeriodGrowth = AiPeriodMetric & {
  targetPeriod: string | null
  comparisonPeriod: string | null
}

export interface AiPeriodMetrics {
  growth: AiPeriodGrowth
  risk: AiPeriodMetric
  fit: AiPeriodMetric
}

export interface AiAnalysisV2Response extends AiAnalysisResponseBase {
  schemaVersion: '2.0'
  ai: AiAnalysisState & { metrics: AiPeriodMetrics; warnings: string[] }
}

export type AiAnalysisResponse = AiAnalysisV1Response | AiAnalysisV2Response

export type AiAnalysisDisplay = AiAnalysisResponse & { requestId: string }

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
  period: string | null
  analyzedAt: string
  source: 'demo' | 'api'
  scores: { overall: Score | null; growth: Score | null; risk: Score | null; fit: Score | null }
  factors: { name: string; description: string; contribution: number }[]
  trends: TrendPoint[]
  competition: { name: string; local: number; average: number; unit: string }[]
  map: { center: [number, number]; boundary: [number, number][]; places: MapPlace[] }
  summary: string
  recommendations: string[]
  regionalSummary?: RegionalSummary
  researchForecast?: ResearchForecast | null
  ai?: AiAnalysisDisplay | null
}

export type DemoScenario = 'success' | 'empty' | 'error'
