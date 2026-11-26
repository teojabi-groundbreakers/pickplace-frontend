import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLocalResearchForecast } from '../lib/localResearchForecast'

const requestId = 'local-research-1'
const selection = { regionCode: '1111051500', industryCode: 'I21007' }
const scope = {
  ...selection,
  regionName: '청운효자동',
  sourceRegionCode: '11110515',
  sourceIndustryCode: 'CS100008',
  sourceIndustryName: '분식전문점',
}
const forecastData = {
  mode: 'experimental_research_only',
  region_code_system: 'seoul-adstrd',
  region_code: '11110515',
  industry_code: 'CS100008',
  base_period: '2026Q2',
  target_period: '2026Q4',
  comparison_period: '2025Q4',
  model_sha256: '0123456789abcdef'.repeat(4),
  snapshot_available_at: '2026-11-13',
  input_values_verified: false,
  region_scope_verified: false,
  status: 'available',
  estimate_kind: 'in_progress_or_future_quarter_estimate',
  estimated_yoy_growth: -0.0921358,
  reason: null,
  warnings: ['research_only_not_point_in_time_validated'],
  retrospective_test: {
    target_period: '2025Q4',
    rows: 100,
    mae_pp: 20,
    median_absolute_error_pp: 14,
  },
}

function mockResearchResponse(data: unknown, responseRequestId = requestId, responseScope = scope) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { data, meta: { requestId, scope: responseScope } },
        { headers: { 'X-Request-Id': responseRequestId } },
      ),
    )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('local research forecast', () => {
  it('uses the same-origin research endpoint and returns a research card with the backend estimate', async () => {
    const fetchMock = mockResearchResponse(forecastData)
    const controller = new AbortController()

    const result = await getLocalResearchForecast(selection, controller.signal)
    expect(result).toMatchObject({
      status: 'available',
      scopeLabel: '청운효자동 · 서울 원천 분식전문점 기준 (CS100008)',
    })
    expect(result.status === 'available' && result.forecast).toMatchObject({
      mode: 'experimental_research_only',
      method: 'model_inference',
      basePeriod: '2026Q2',
      modelVersion: forecastData.model_sha256,
      predictions: [
        {
          targetPeriod: '2026Q4',
          estimatedYoYGrowth: -0.0921358,
          retrospectiveTest: { targetPeriod: '2025Q4', maePp: 20, medianAbsoluteErrorPp: 14 },
        },
      ],
    })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      '/__ai-model-api/research/forecast?regionCode=1111051500&industryCode=I21007',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
    )
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body')
  })

  it.each([
    [{ industry_code: 'I21201' }, requestId],
    [{ region_code: '1111051500' }, requestId],
    [{ target_period: '2026Q3' }, requestId],
    [{ comparison_period: '2026Q2' }, requestId],
    [{ model_sha256: 'invalid' }, requestId],
    [{ input_values_verified: true }, requestId],
    [{ mode: 'production' }, requestId],
    [{ estimated_yoy_growth: null }, requestId],
    [{ estimate_kind: ['in_progress_or_future_quarter_estimate'] }, requestId],
    [{}, 'unmatched-id'],
  ])('rejects inconsistent response data (%j, %s)', async (change, responseRequestId) => {
    mockResearchResponse({ ...forecastData, ...change }, responseRequestId)

    await expect(getLocalResearchForecast(selection, new AbortController().signal)).rejects.toThrow(
      '연구 모델 결과를 불러오지 못했어요.',
    )
  })

  it('preserves unavailable predictions without creating a numeric value', async () => {
    mockResearchResponse({
      ...forecastData,
      status: 'unavailable',
      estimated_yoy_growth: null,
      reason: 'missing_sales',
      retrospective_test: null,
    })

    await expect(
      getLocalResearchForecast(selection, new AbortController().signal),
    ).resolves.toMatchObject({
      forecast: {
        predictions: [{ status: 'unavailable', estimatedYoYGrowth: null, reason: 'missing_sales' }],
      },
    })
  })

  it('rejects research results resolved from a different user selection', async () => {
    mockResearchResponse(forecastData, requestId, { ...scope, regionCode: '1153073000' })
    await expect(getLocalResearchForecast(selection, new AbortController().signal)).rejects.toThrow(
      '연구 모델 결과를 불러오지 못했어요.',
    )
  })

  it('preserves the local bridge reason when there is no research scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: 'RESEARCH_SCOPE_NOT_AVAILABLE' }, { status: 404 }),
        ),
    )
    await expect(
      getLocalResearchForecast(selection, new AbortController().signal),
    ).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('preserves caller cancellation and does not fetch an already-aborted request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()

    await expect(getLocalResearchForecast(selection, controller.signal)).rejects.toBe(
      controller.signal.reason,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
