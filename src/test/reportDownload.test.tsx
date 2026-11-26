import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { toAnalysis } from '../lib/aiAnalysis'
import { config } from '../lib/config'
import { getLocalResearchForecast, type LocalResearchResult } from '../lib/localResearchForecast'
import { downloadReport } from '../lib/reports'
import { aiPeriodTestEnvelope, aiTestContext, aiTestRequest } from './aiFixtures'

vi.mock('../lib/localResearchForecast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/localResearchForecast')>()),
  getLocalResearchForecast: vi.fn(),
}))

vi.mock('../lib/reports', () => ({
  downloadReport: vi.fn(),
}))

const fetchResearch = vi.mocked(getLocalResearchForecast)
const download = vi.mocked(downloadReport)
const originalLocalResearch = config.localResearchForecast

const localResearch: LocalResearchResult = {
  status: 'available',
  scopeLabel: '청운효자동 · 서울 원천 커피 전문점 기준 (CS100010)',
  forecast: {
    mode: 'experimental_research_only',
    method: 'model_inference',
    basePeriod: '2026Q2',
    dataAsOf: '2026-11-13',
    modelVersion: 'report-test-model',
    inputValuesVerified: false,
    regionScopeVerified: false,
    predictions: [
      {
        status: 'available',
        targetPeriod: '2026Q4',
        estimateKind: 'in_progress_or_future_quarter_estimate',
        estimatedYoYGrowth: 0.144,
        reason: null,
        warnings: [],
      },
    ],
  },
}

const reference = {
  referenceDate: '2026-06-30',
  sourceIndustryName: '커피 전문점',
  cohortSize: 121,
  residentsPerStore: { value: 86.15, percentile: 5 },
  storesPerKm2: { value: 48.03, percentile: 46.67 },
}

const { data, meta } = aiPeriodTestEnvelope()
const result = toAnalysis(aiTestRequest, data, meta.requestId, aiTestContext)

function panel(resultMatchesSelection: boolean) {
  return (
    <AnalysisPanel
      state={{ status: 'success', result }}
      run={vi.fn()}
      saved={[]}
      onSave={vi.fn()}
      resultMatchesSelection={resultMatchesSelection}
      dismissedState={null}
      setDismissedState={vi.fn()}
    />
  )
}

beforeEach(() => {
  config.localResearchForecast = true
  fetchResearch.mockReset().mockResolvedValue(localResearch)
  download.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  config.localResearchForecast = originalLocalResearch
  vi.unstubAllGlobals()
})

describe('분석 결과 PDF 다운로드', () => {
  it('화면에 표시된 연구 추정과 적합도 비교를 재요청 없이 사용한다', async () => {
    const fitFetch = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          reference_date: reference.referenceDate,
          cohort_size: reference.cohortSize,
          residents_per_store: {
            ...reference.residentsPerStore,
            status: 'available',
            unit: 'persons_per_store',
          },
          stores_per_km2: {
            ...reference.storesPerKm2,
            status: 'available',
            unit: 'stores_per_km2',
          },
        },
        meta: { scope: { ...aiTestRequest, sourceIndustryName: reference.sourceIndustryName } },
      }),
    )
    vi.stubGlobal('fetch', fitFetch)
    const user = userEvent.setup()
    const { rerender } = render(panel(true))

    expect(await screen.findByText('+14.4%')).toBeInTheDocument()
    const benchmark = await screen.findByRole('region', { name: '서울 동일 업종 비교' })
    expect(within(benchmark).getByRole('row', { name: '점포당 주민 수 86.15명 5' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '보고서 다운로드' }))
    expect(download).toHaveBeenCalledExactlyOnceWith(result, {
      research: localResearch,
      fit: { status: 'available', reference },
    })
    expect(fetchResearch).toHaveBeenCalledTimes(1)
    expect(fitFetch).toHaveBeenCalledTimes(1)

    rerender(panel(false))
    expect(screen.queryByText('+14.4%')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '보고서 다운로드' }))
    expect(download).toHaveBeenNthCalledWith(2, result, undefined)
  })

  it('PDF 생성 중 중복 요청을 막고 실패 후 다시 시도할 수 있다', async () => {
    config.localResearchForecast = false
    let failDownload: (error: Error) => void = () => {}
    download.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          failDownload = reject
        }),
    )
    render(panel(true))
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '보고서 다운로드' }))
    expect(screen.getByRole('button', { name: 'PDF 준비 중…' })).toBeDisabled()
    await act(async () => failDownload(new Error('test error')))
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF를 저장하지 못했어요.')
    await user.click(screen.getByRole('button', { name: '보고서 다운로드' }))
    expect(download).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
