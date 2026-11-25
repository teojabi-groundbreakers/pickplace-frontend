import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FitReferenceBenchmark, FitReferenceIndicators } from '../components/FitComparison'
import { useFitReference } from '../lib/useFitReference'
import type { AnalysisRequest } from '../types/analysis'

const selection = { regionCode: '1111051500', industryCode: 'I21201' }

function FitViews({ selection }: { selection?: AnalysisRequest }) {
  const state = useFitReference(selection)
  return (
    <>
      <section aria-label="적합도 참고 지표">
        <FitReferenceIndicators state={state} />
      </section>
      <FitReferenceBenchmark state={state} />
    </>
  )
}

function comparisonBody() {
  return {
    data: {
      base_period: '2026Q2',
      reference_date: '2026-06-30',
      cohort_size: 121,
      residents_per_store: {
        status: 'available',
        unit: 'persons_per_store',
        value: 86.145161,
        percentile: 5,
        reason: null,
      },
      stores_per_km2: {
        status: 'available',
        unit: 'stores_per_km2',
        value: 48.026849,
        percentile: 46.67,
        reason: null,
      },
    },
    meta: { scope: { ...selection, sourceIndustryName: '커피 전문점' } },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('local fit comparison', () => {
  it('displays card and benchmark together from a single response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(comparisonBody()))
    vi.stubGlobal('fetch', fetchMock)

    render(<FitViews selection={selection} />)
    const indicators = within(screen.getByRole('region', { name: '적합도 참고 지표' }))
    expect(await indicators.findByText('86.15명')).toBeInTheDocument()
    expect(indicators.getByText('48.03곳/㎢')).toBeInTheDocument()
    expect(indicators.getByText('2026-06-30')).toHaveAttribute('datetime', '2026-06-30')
    expect(indicators.getByText('서울 원천 커피 전문점 참고 지표')).toBeInTheDocument()
    const benchmark = within(screen.getByRole('region', { name: '서울 동일 업종 비교' }))
    expect(benchmark.getByText(/커피 전문점 · 서울 검증 표본 121개 행정동/)).toBeInTheDocument()
    expect(benchmark.getByText('2026-06-30')).toHaveAttribute('datetime', '2026-06-30')
    expect(benchmark.getByRole('row', { name: '점포당 주민 수 86.15명 5' })).toBeInTheDocument()
    expect(benchmark.getByRole('row', { name: '점포 밀집도 48.03곳/㎢ 46.67' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      '/__ai-model-api/fit-reference?regionCode=1111051500&industryCode=I21201',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('preserves observed ratios when their percentiles are unavailable', async () => {
    const body = comparisonBody()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          ...body,
          data: {
            ...body.data,
            residents_per_store: { ...body.data.residents_per_store, percentile: null },
            stores_per_km2: { ...body.data.stores_per_km2, percentile: 101 },
          },
        }),
      ),
    )

    render(<FitViews selection={selection} />)
    const benchmark = within(await screen.findByRole('region', { name: '서울 동일 업종 비교' }))
    expect(
      benchmark.getByRole('row', { name: '점포당 주민 수 86.15명 자료 없음' }),
    ).toBeInTheDocument()
    expect(
      benchmark.getByRole('row', { name: '점포 밀집도 48.03곳/㎢ 자료 없음' }),
    ).toBeInTheDocument()
  })

  it('does not display a comparison returned for a different industry', async () => {
    const body = comparisonBody()
    body.meta.scope.industryCode = 'I21007'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))

    render(<FitViews selection={selection} />)
    expect(await screen.findByText('비교 지표를 불러오지 못했습니다.')).toBeInTheDocument()
    expect(screen.queryByText('86.15명')).not.toBeInTheDocument()
  })

  it.each([
    [404, '적합도 경계 검증 미달. 서울시와 행안부 자료의 행정동 경계가 기준만큼 겹치지 않습니다.'],
    [500, '비교 지표를 불러오지 못했습니다.'],
  ])(
    'shows the boundary reason only on the expected HTTP response (%s)',
    async (status, message) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            Response.json({ code: 'FIT_REFERENCE_BOUNDARY_UNVERIFIED' }, { status }),
          ),
      )

      render(<FitViews selection={{ regionCode: '1141058500', industryCode: 'I21007' }} />)
      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(screen.queryByText('이 지역에 제공할 비교 지표가 없습니다.')).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: '서울 동일 업종 비교' })).not.toBeInTheDocument()
    },
  )

  it('clears previous selection and aborts its pending comparison', async () => {
    let resolveOld: (response: Response) => void = () => {}
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValueOnce(
        Response.json({ code: 'FIT_REFERENCE_NOT_AVAILABLE' }, { status: 404 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = render(<FitViews selection={selection} />)
    const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal
    rerender(<FitViews selection={{ ...selection, industryCode: 'I21007' }} />)

    expect(oldSignal.aborted).toBe(true)
    expect(await screen.findByText('이 지역에 제공할 비교 지표가 없습니다.')).toBeInTheDocument()
    await act(async () => resolveOld(Response.json(comparisonBody())))
    expect(screen.queryByText('86.15명')).not.toBeInTheDocument()
  })

  it('does not query or show a benchmark without a current local selection', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<FitViews />)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: '서울 동일 업종 비교' })).not.toBeInTheDocument()
  })
})
