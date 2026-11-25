import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { createDemoAnalysis, defaultRequest } from '../data/demo'
import { config } from '../lib/config'
import { getLocalResearchForecast } from '../lib/localResearchForecast'
import type { Analysis, ResearchForecast } from '../types/analysis'

vi.mock('../lib/localResearchForecast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/localResearchForecast')>()),
  getLocalResearchForecast: vi.fn(),
}))

const requestForecast = vi.mocked(getLocalResearchForecast)
const saved = vi.fn()
const analysis: Analysis = {
  ...createDemoAnalysis(defaultRequest),
  source: 'api',
  id: 'cheongun-test',
  request: { regionCode: '1111051500', industryCode: 'I21201' },
}
const forecast: ResearchForecast = {
  mode: 'experimental_research_only',
  method: 'model_inference',
  basePeriod: '2026Q2',
  dataAsOf: '2026-11-13',
  modelVersion: 'model-for-test',
  inputValuesVerified: false,
  regionScopeVerified: false,
  predictions: [
    {
      status: 'available',
      targetPeriod: '2026Q4',
      estimateKind: 'in_progress_or_future_quarter_estimate',
      estimatedYoYGrowth: -0.0921358,
      reason: null,
      warnings: [],
    },
  ],
}

function panel(result = analysis, resultMatchesSelection = true) {
  return (
    <AnalysisPanel
      state={{ status: 'success', result }}
      run={vi.fn()}
      saved={[]}
      onSave={saved}
      resultMatchesSelection={resultMatchesSelection}
      dismissedState={null}
      setDismissedState={vi.fn()}
    />
  )
}

const originalFlag = config.localResearchForecast
beforeEach(() => {
  config.localResearchForecast = true
  requestForecast.mockReset()
  saved.mockReset()
})

afterEach(() => {
  config.localResearchForecast = originalFlag
})

describe('existing area analysis with local research forecast', () => {
  it('only offers a research request for the current local test selection', () => {
    config.localResearchForecast = false
    const { rerender } = render(panel())
    expect(screen.queryByRole('button', { name: '연구용 추정 보기' })).not.toBeInTheDocument()

    config.localResearchForecast = true
    rerender(panel(analysis, false))
    expect(screen.queryByRole('button', { name: '연구용 추정 보기' })).not.toBeInTheDocument()

    rerender(panel({ ...analysis, request: { regionCode: '2611053000', industryCode: 'I21201' } }))
    expect(screen.queryByRole('button', { name: '연구용 추정 보기' })).not.toBeInTheDocument()

    rerender(panel())
    expect(screen.getByRole('button', { name: '연구용 추정 보기' })).toBeInTheDocument()
    expect(requestForecast).not.toHaveBeenCalled()
  })

  it('retries a failed request and renders the result under the Seoul source scope', async () => {
    requestForecast.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      status: 'available',
      forecast,
      scopeLabel: '청운효자동 · 서울 원천 커피 전문점 기준 (CS100010)',
    })
    const user = userEvent.setup()
    render(panel())

    await user.click(screen.getByRole('button', { name: '연구용 추정 보기' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('연구 결과를 불러오지 못했어요.')
    await user.click(screen.getByRole('button', { name: '연구용 추정 다시 시도' }))

    const research = screen.getByRole('region', { name: '연구용 매출 성장률 추정' })
    expect(await within(research).findByText('-9.2%')).toBeInTheDocument()
    expect(
      within(research).getByText(/서울 원천 커피 전문점 기준 \(CS100010\)/),
    ).toBeInTheDocument()
    expect(within(research).getByRole('heading', { name: '2026Q4' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '분석 저장' }))
    expect(saved).toHaveBeenCalledWith(analysis)
  })

  it('cancels a pending research request when the active selection changes', async () => {
    requestForecast.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    const { rerender } = render(panel())
    await user.click(screen.getByRole('button', { name: '연구용 추정 보기' }))
    const [selection, signal] = requestForecast.mock.calls[0]
    expect(selection).toEqual(analysis.request)
    expect(screen.getByRole('button', { name: '연구용 추정 중…' })).toBeDisabled()

    rerender(panel(analysis, false))
    expect(signal.aborted).toBe(true)
  })

  it('offers research for other supported Seoul selections and handles missing local data', async () => {
    requestForecast.mockResolvedValue({ status: 'unavailable' })
    const selection = { regionCode: '1153073000', industryCode: 'I21007' }
    render(panel({ ...analysis, request: selection }))
    await userEvent.setup().click(screen.getByRole('button', { name: '연구용 추정 보기' }))
    expect(
      await screen.findByText(/예측에 필요한 매출 이력을 확인할 수 없어요/),
    ).toBeInTheDocument()
    expect(requestForecast).toHaveBeenCalledWith(selection, expect.any(AbortSignal))
  })
})
