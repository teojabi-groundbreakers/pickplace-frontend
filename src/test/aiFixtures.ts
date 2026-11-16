import type {
  AiAnalysisV1Response,
  AiAnalysisV2Response,
  AnalysisDisplayContext,
  AnalysisRequest,
} from '../types/analysis'

export const aiTestRequest: AnalysisRequest = {
  regionCode: '1111051500',
  industryCode: 'I21201',
}

export const aiTestContext: AnalysisDisplayContext = {
  regionName: '서울특별시 종로구 청운효자동',
  industryName: '커피·음료',
  center: [37.58, 126.97],
}

export function aiTestEnvelope(
  request: AnalysisRequest = aiTestRequest,
  state: 'AVAILABLE' | 'SKIPPED' | 'FAILED' = 'AVAILABLE',
) {
  const data: AiAnalysisV1Response = {
    request,
    asOf: '2026-11-13',
    basePeriod: '2026Q3',
    statistics: { version: 'v1', metrics: {} },
    ai: {
      state,
      reason: state === 'AVAILABLE' ? null : 'mapping_unverified',
      transportStatus: null,
      result:
        state === 'AVAILABLE'
          ? {
              schema_version: '1.0',
              region_code: request.regionCode,
              region_code_system: 'H10',
              industry_code: request.industryCode,
              source_kind: 'official',
              as_of: '2026-11-13',
              base_period: '2026Q3',
              model_version: null,
              policy_version: 'draft-1',
              warnings: ['draft_scoring_policy'],
              growth: {
                status: 'unavailable',
                reason: 'model_not_found',
                estimated_yoy_growth: null,
                target_period: '2026Q4',
                comparison_period: '2025Q4',
                model_version: null,
                explanations: [],
              },
              risk: {
                status: 'available',
                reason: null,
                score: 42,
                policy_status: 'draft',
                components: [],
              },
              fit: {
                status: 'available',
                reason: null,
                score: 65,
                policy_status: 'draft',
                components: [],
              },
            }
          : null,
    },
  }
  return { data, meta: { requestId: 'ai-test-request' } }
}

export function aiPeriodTestEnvelope() {
  const data: AiAnalysisV2Response = {
    schemaVersion: '2.0',
    request: aiTestRequest,
    asOf: '2026-11-16',
    statistics: {
      version: 'v1',
      metrics: {
        residentPopulation: { value: 100, status: 'AVAILABLE', reasonCode: null },
        totalStoreCount: { value: null, status: 'UNAVAILABLE', reasonCode: 'source_not_approved' },
      },
    },
    ai: {
      state: 'AVAILABLE',
      reason: null,
      transportStatus: null,
      metrics: {
        growth: {
          basePeriod: '2026Q2',
          targetPeriod: '2026Q3',
          comparisonPeriod: '2025Q3',
          status: 'unavailable',
          value: null,
          reason: 'target_not_future',
        },
        risk: { basePeriod: '2026Q2', status: 'available', value: 42, reason: null },
        fit: { basePeriod: '2026Q3', status: 'available', value: 65, reason: null },
      },
      warnings: ['draft_scoring_policy'],
    },
  }
  return { data, meta: { requestId: 'ai-period-test-request' } }
}
