import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AreaMap } from '../components/AreaMap'
import { config } from '../lib/config'
import { createDemoAnalysis, defaultRequest, demoCatalog } from '../data/demo'
import type { KakaoRegionResult } from '../lib/kakaoMaps'
import type { RegionBoundary } from '../types/boundary'
import type { MapRendererProps } from '../types/map'

const services = vi.hoisted(() => ({
  lookup: vi.fn(),
  boundary: vi.fn(),
}))
vi.mock('../lib/config', () => ({
  config: {
    apiBaseUrl: '/api',
    requestTimeout: 30_000,
    kakaoMapAppKey: '',
    demoMode: false,
  },
}))
vi.mock('../lib/regionLookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionLookup')>()),
  lookupAdministrativeRegion: services.lookup,
}))
vi.mock('../lib/regionBoundary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionBoundary')>()),
  getRegionBoundary: services.boundary,
}))
vi.mock('../components/KakaoMap', () => ({
  KakaoMap: ({
    administrativeBoundary,
    hideAnalysisBoundary,
    onBoundaryFailure,
    onPointSelect,
  }: MapRendererProps) => (
    <section aria-label="경계 테스트 카카오지도">
      <button onClick={() => onPointSelect?.([37.54, 127.05])}>조회 위치 A</button>
      <button onClick={() => onPointSelect?.([37.53213, 126.99267])}>조회 위치 B</button>
      {administrativeBoundary && <button onClick={onBoundaryFailure}>경계 그리기 실패</button>}
      <output aria-label="카카오 행정동 경계">
        {JSON.stringify(administrativeBoundary || null)}
      </output>
      <output aria-label="분석 경계 숨김">{String(hideAnalysisBoundary)}</output>
    </section>
  ),
}))

const firstRegion: KakaoRegionResult = {
  region_type: 'H',
  code: '1120069000',
  address_name: '서울특별시 성동구 성수2가제1동',
  region_1depth_name: '서울특별시',
  region_2depth_name: '성동구',
  region_3depth_name: '성수2가제1동',
}
const secondRegion: KakaoRegionResult = {
  ...firstRegion,
  code: '1117065000',
  address_name: '서울특별시 용산구 이태원1동',
  region_2depth_name: '용산구',
  region_3depth_name: '이태원1동',
}

function boundary(region = firstRegion): RegionBoundary {
  return {
    regionCode: region.code,
    regionType: 'H',
    regionName: region.address_name,
    coordinateSystem: 'EPSG:4326',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [127.04, 37.53],
          [127.06, 37.53],
          [127.06, 37.55],
          [127.04, 37.53],
        ],
      ],
    },
    labelPosition: [127.05, 37.54],
    boundaryDate: '2026-09-30',
    source: { name: '경계 제공기관 (테스트)', url: 'https://example.com/boundaries' },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

const example = createDemoAnalysis(defaultRequest)
const props = {
  data: { ...example.map, regionName: example.regionName, isDemo: false },
  regions: [
    {
      code: defaultRequest.regionCode,
      name: '성수2가1동',
      fullName: '성동구 성수2가1동',
      center: example.map.center,
    },
  ],
  selectedRegionCode: defaultRequest.regionCode,
  onRegionSelect: vi.fn(),
  onExploreRegion: vi.fn(),
  analysis: {
    categories: demoCatalog.categories,
    industryCode: defaultRequest.industryCode,
    onIndustryChange: vi.fn(),
    onAnalyze: vi.fn(),
  },
}

function displayedBoundary() {
  return JSON.parse(screen.getByLabelText('카카오 행정동 경계').textContent || '')
}

beforeEach(() => {
  config.demoMode = false
  services.lookup.mockReset().mockResolvedValue(firstRegion)
  services.boundary.mockReset().mockResolvedValue(null)
  props.onRegionSelect.mockClear()
  props.onExploreRegion.mockClear()
  props.analysis.onIndustryChange.mockClear()
  props.analysis.onAnalyze.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function query() {
  const user = userEvent.setup()
  const view = render(<AreaMap {...props} />)
  await user.click(screen.getByRole('button', { name: '조회 위치 A' }))
  await screen.findByText(firstRegion.address_name)
  return { user, view }
}

describe('행정동 경계 UI와 분석 전 조회', () => {
  it('우클릭 H10을 그대로 조회하고 로딩 후 경계·출처·기준일을 표시한다', async () => {
    const pending = deferred<RegionBoundary | null>()
    services.boundary.mockReturnValue(pending.promise)
    const { user } = await query()
    expect(services.boundary).toHaveBeenCalledWith(firstRegion.code, expect.any(AbortSignal))
    expect(screen.getByLabelText('행정동 경계 상태')).toHaveTextContent(/불러|확인|조회/)
    expect(displayedBoundary()).toBeNull()
    expect(screen.getByLabelText('분석 경계 숨김')).toHaveTextContent('true')
    const result = boundary()
    await act(async () => pending.resolve(result))
    expect(displayedBoundary()).toEqual(result)
    expect(screen.getByLabelText('행정동 경계 상태')).toHaveTextContent(result.source.name)
    expect(screen.getByLabelText('행정동 경계 상태')).toHaveTextContent(result.boundaryDate)
    expect(screen.getByRole('link', { name: result.source.name })).toHaveAttribute(
      'href',
      result.source.url,
    )
    await user.click(screen.getByRole('button', { name: '이 지역 분석' }))
    expect(props.analysis.onAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({ code: firstRegion.code }),
      defaultRequest.industryCode,
    )
  })

  it('선택한 10자리 행정동도 분석 요청 없이 경계를 조회한다', async () => {
    services.boundary.mockResolvedValue(boundary(secondRegion))
    render(
      <AreaMap
        {...props}
        selectedRegionCode={secondRegion.code}
      />,
    )
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary(secondRegion)))
    expect(services.boundary).toHaveBeenCalledWith(secondRegion.code, expect.any(AbortSignal))
    expect(props.analysis.onAnalyze).not.toHaveBeenCalled()
    expect(services.lookup).not.toHaveBeenCalled()
  })

  it('8자리 선택 코드를 임의로 늘려 실제 경계를 요청하지 않는다', () => {
    render(<AreaMap {...props} />)
    expect(services.boundary).not.toHaveBeenCalled()
    expect(displayedBoundary()).toBeNull()
  })

  it.each([defaultRequest.regionCode, firstRegion.code])(
    '데모 %s 선택은 실제 경계 미제공을 안내하며 경계 HTTP 요청을 보내지 않는다',
    async (regionCode) => {
      config.demoMode = true
      const original =
        await vi.importActual<typeof import('../lib/regionBoundary')>('../lib/regionBoundary')
      services.boundary.mockImplementation(original.getRegionBoundary)
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      render(
        <AreaMap
          {...props}
          data={{ ...props.data, isDemo: true }}
          selectedRegionCode={regionCode}
        />,
      )
      await waitFor(() =>
        expect(screen.getByLabelText('행정동 경계 상태')).toHaveTextContent(/데모/),
      )
      expect(screen.getByLabelText('행정동 경계 상태')).toHaveTextContent(/경계/)
      expect(displayedBoundary()).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it('경계가 없는 행정동도 분석과 둘러보기를 막지 않는다', async () => {
    const { user } = await query()
    expect(screen.getByLabelText('행정동 경계 상태')).toHaveTextContent(/없|제공/)
    expect(displayedBoundary()).toBeNull()
    expect(screen.getByRole('button', { name: '이 지역 분석' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '이 지역 둘러보기' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '이 지역 둘러보기' }))
    expect(props.onExploreRegion).toHaveBeenCalledWith(
      expect.objectContaining({ code: firstRegion.code }),
    )
    expect(props.analysis.onAnalyze).not.toHaveBeenCalled()
  })

  it('경계 조회 오류만 표시하고 같은 H 코드로 재시도한 뒤 경계를 복구한다', async () => {
    services.boundary.mockRejectedValueOnce(new Error('경계 서버 연결 오류'))
    services.boundary.mockResolvedValueOnce(boundary())
    const { user } = await query()
    expect(screen.getByRole('region', { name: '경계 테스트 카카오지도' })).toBeInTheDocument()
    expect(screen.queryByText('카카오지도를 불러오지 못했어요.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('행정동 경계 상태')).toHaveTextContent('경계 서버 연결 오류')
    expect(screen.getByRole('button', { name: '이 지역 분석' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '이 지역 둘러보기' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '경계 다시 조회' }))
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary()))
    expect(services.boundary).toHaveBeenCalledTimes(2)
    expect(services.boundary.mock.calls.every(([code]) => code === firstRegion.code)).toBe(true)
    expect(props.analysis.onAnalyze).not.toHaveBeenCalled()
  })

  it('카카오 경계 그리기 실패를 지도 전체 오류와 분리하고 재조회할 수 있다', async () => {
    services.boundary.mockImplementation(() => Promise.resolve(boundary()))
    const { user } = await query()
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary()))
    await user.click(screen.getByRole('button', { name: '경계 그리기 실패' }))
    expect(screen.getByRole('region', { name: '경계 테스트 카카오지도' })).toBeInTheDocument()
    expect(screen.queryByText('카카오지도를 불러오지 못했어요.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('행정동 경계 상태')).toHaveTextContent('경계를 표시하지 못했어요')
    expect(displayedBoundary()).toBeNull()
    expect(screen.getByRole('button', { name: '이 지역 분석' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '이 지역 둘러보기' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '경계 다시 조회' }))
    await waitFor(() => expect(services.boundary).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary()))
    expect(services.boundary).toHaveBeenLastCalledWith(firstRegion.code, expect.any(AbortSignal))
  })

  it('업종만 바꾸면 같은 행정동의 카드와 경계를 유지하고 중복 조회하지 않는다', async () => {
    services.boundary.mockResolvedValue(boundary())
    const { user, view } = await query()
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary()))
    await user.selectOptions(screen.getByLabelText('분석할 업종'), 'beauty')
    view.rerender(
      <AreaMap
        {...props}
        analysis={{ ...props.analysis, industryCode: 'beauty' }}
      />,
    )
    expect(screen.getByRole('region', { name: '행정구역 조회' })).toBeInTheDocument()
    expect(displayedBoundary()).toEqual(boundary())
    expect(services.boundary).toHaveBeenCalledTimes(1)
  })
})

describe('행정동 경계의 조회 우선순위와 요청 취소', () => {
  it('새 위치 조회 중 이전 경계를 숨기고 늦은 응답으로 최신 경계를 덮어쓰지 않는다', async () => {
    const first = deferred<RegionBoundary | null>()
    const second = deferred<RegionBoundary | null>()
    const nextRegion = deferred<KakaoRegionResult>()
    services.boundary.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    services.lookup.mockResolvedValueOnce(firstRegion).mockReturnValueOnce(nextRegion.promise)
    const { user } = await query()
    const firstSignal = services.boundary.mock.calls[0][1] as AbortSignal
    await user.click(screen.getByRole('button', { name: '조회 위치 B' }))
    expect(firstSignal.aborted).toBe(true)
    expect(displayedBoundary()).toBeNull()
    expect(screen.getByLabelText('분석 경계 숨김')).toHaveTextContent('true')
    await act(async () => nextRegion.resolve(secondRegion))
    expect(services.boundary).toHaveBeenLastCalledWith(secondRegion.code, expect.any(AbortSignal))
    await act(async () => second.resolve(boundary(secondRegion)))
    await act(async () => first.resolve(boundary()))
    expect(displayedBoundary()).toEqual(boundary(secondRegion))
    expect(screen.getByRole('region', { name: '행정구역 조회' })).toHaveTextContent(
      secondRegion.address_name,
    )
  })

  it('우클릭 카드 경계를 우선하고 닫으면 선택한 H10의 경계를 다시 조회한다', async () => {
    services.boundary.mockImplementation((code: string) =>
      Promise.resolve(boundary(code === firstRegion.code ? firstRegion : secondRegion)),
    )
    services.lookup.mockResolvedValue(secondRegion)
    const user = userEvent.setup()
    render(
      <AreaMap
        {...props}
        selectedRegionCode={firstRegion.code}
      />,
    )
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary()))
    await user.click(screen.getByRole('button', { name: '조회 위치 B' }))
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary(secondRegion)))
    await user.click(screen.getByRole('button', { name: '행정구역 조회 닫기' }))
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary()))
    expect(services.boundary.mock.calls.map(([code]) => code)).toEqual([
      firstRegion.code,
      secondRegion.code,
      firstRegion.code,
    ])
  })

  it('선택 지역을 바꿨다가 돌아와도 이전 우클릭 카드를 복원하지 않는다', async () => {
    services.boundary.mockImplementation((code: string) =>
      Promise.resolve(boundary(code === firstRegion.code ? firstRegion : secondRegion)),
    )
    services.lookup.mockResolvedValue(secondRegion)
    const user = userEvent.setup()
    const view = render(
      <AreaMap
        {...props}
        selectedRegionCode={firstRegion.code}
      />,
    )
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary()))
    await user.click(screen.getByRole('button', { name: '조회 위치 B' }))
    expect(await screen.findByRole('region', { name: '행정구역 조회' })).toHaveTextContent(
      secondRegion.address_name,
    )
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary(secondRegion)))

    view.rerender(
      <AreaMap
        {...props}
        selectedRegionCode={secondRegion.code}
      />,
    )
    expect(screen.queryByRole('region', { name: '행정구역 조회' })).not.toBeInTheDocument()
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary(secondRegion)))

    view.rerender(
      <AreaMap
        {...props}
        selectedRegionCode={firstRegion.code}
      />,
    )
    expect(screen.queryByRole('region', { name: '행정구역 조회' })).not.toBeInTheDocument()
    await waitFor(() => expect(displayedBoundary()).toEqual(boundary()))
    expect(screen.queryByRole('region', { name: '행정구역 조회' })).not.toBeInTheDocument()
    expect(services.lookup).toHaveBeenCalledTimes(1)
  })

  it.each(['카드 닫기', '선택 지역 변경', '둘러보기', '언마운트'])(
    '%s는 진행 중 경계를 취소하고 나중에 도착한 경계를 표시하지 않는다',
    async (action) => {
      const pending = deferred<RegionBoundary | null>()
      services.boundary.mockReturnValue(pending.promise)
      const { user, view } = await query()
      const signal = services.boundary.mock.calls[0][1] as AbortSignal
      if (action === '카드 닫기') {
        await user.click(screen.getByRole('button', { name: '행정구역 조회 닫기' }))
      } else if (action === '선택 지역 변경') {
        view.rerender(
          <AreaMap
            {...props}
            selectedRegionCode="11170650"
          />,
        )
      } else if (action === '둘러보기') {
        await user.click(screen.getByRole('button', { name: '이 지역 둘러보기' }))
      } else {
        view.unmount()
      }
      expect(signal.aborted).toBe(true)
      await act(async () => pending.resolve(boundary()))
      if (action !== '언마운트') {
        expect(displayedBoundary()).toBeNull()
        expect(screen.queryByRole('region', { name: '행정구역 조회' })).not.toBeInTheDocument()
      }
      expect(screen.queryByText(boundary().source.name)).not.toBeInTheDocument()
    },
  )
})
