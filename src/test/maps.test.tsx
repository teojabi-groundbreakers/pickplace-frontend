import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AreaMap } from '../components/AreaMap'
import type { MapRendererProps } from '../types/map'
import { createDemoAnalysis, defaultRequest, demoCatalog } from '../data/demo'
import type { KakaoRegionResult } from '../lib/kakaoMaps'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('../lib/regionLookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionLookup')>()),
  lookupAdministrativeRegion: lookup,
}))

vi.mock('../lib/config', () => ({
  config: { kakaoMapAppKey: '' },
}))

const kakao = vi.hoisted(() => ({
  onPointSelect: undefined as MapRendererProps['onPointSelect'],
  mounts: 0,
  unmounts: 0,
  failOnMount: false,
}))
vi.mock('../components/KakaoMap', async () => {
  const { useEffect } = await import('react')
  return {
    KakaoMap: ({ onFailure, onPointSelect, exploreRegion, data }: MapRendererProps) => {
      kakao.onPointSelect = onPointSelect
      useEffect(() => {
        kakao.mounts += 1
        if (kakao.failOnMount) onFailure()
        return () => {
          kakao.unmounts += 1
        }
      }, [onFailure])
      return (
        <section aria-label="카카오 테스트 지도">
          <button onClick={onFailure}>카카오 연결 실패 시뮬레이션</button>
          <button onClick={() => onPointSelect?.([37.54, 127.05])}>중심 위치 조회</button>
          <output aria-label="둘러보기 위치">{JSON.stringify(exploreRegion || null)}</output>
          <output aria-label="표시 시설">{data.places.map((place) => place.name).join(',')}</output>
        </section>
      )
    },
  }
})

const result = createDemoAnalysis(defaultRequest)
const props = {
  data: { ...result.map, regionName: result.regionName, isDemo: true },
  regions: [
    {
      code: defaultRequest.regionCode,
      name: '성수2가1동',
      fullName: '성동구 성수2가1동',
      center: result.map.center,
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
beforeEach(() => {
  lookup.mockReset()
  props.onRegionSelect.mockClear()
  props.onExploreRegion.mockClear()
  props.analysis.onIndustryChange.mockClear()
  props.analysis.onAnalyze.mockClear()
  kakao.onPointSelect = undefined
  kakao.mounts = 0
  kakao.unmounts = 0
  kakao.failOnMount = false
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

const administrative: KakaoRegionResult = {
  region_type: 'H',
  code: '1120069000',
  address_name: '서울특별시 성동구 성수2가제1동',
  region_1depth_name: '서울특별시',
  region_2depth_name: '성동구',
  region_3depth_name: '성수2가제1동',
}

describe('지도 위치의 행정구역 조회', () => {
  it('둘러보기 좌표를 이전 분석 데이터와 구분해 카카오지도에 전달한다', () => {
    const region = {
      code: '1117065000',
      name: '이태원1동',
      fullName: '서울특별시 용산구 이태원1동',
      center: [37.53213, 126.99267] as [number, number],
    }
    render(
      <AreaMap
        {...props}
        exploreRegion={region}
      />,
    )
    expect(JSON.parse(screen.getByLabelText('둘러보기 위치').textContent || '')).toEqual(region)
    expect(props.analysis.onAnalyze).not.toHaveBeenCalled()
  })

  it('우클릭한 행정동 코드와 선택 업종으로 분석하며 지역 선택 버튼을 대체한다', async () => {
    lookup.mockResolvedValue(administrative)
    const user = userEvent.setup()
    const view = render(<AreaMap {...props} />)
    await act(async () => kakao.onPointSelect?.([37.54, 127.05]))
    expect(lookup).toHaveBeenCalledWith([37.54, 127.05], '', expect.any(AbortSignal))
    expect(screen.getByText(administrative.address_name)).toBeInTheDocument()
    expect(props.onRegionSelect).not.toHaveBeenCalled()
    expect(screen.getByLabelText('분석할 업종')).toHaveValue('coffee')
    await user.selectOptions(screen.getByLabelText('분석할 업종'), 'beauty')
    expect(props.analysis.onIndustryChange).toHaveBeenCalledWith('beauty')
    view.rerender(
      <AreaMap
        {...props}
        analysis={{ ...props.analysis, industryCode: 'beauty' }}
      />,
    )
    await user.click(screen.getByRole('button', { name: '이 지역 분석' }))
    expect(props.analysis.onAnalyze).toHaveBeenCalledWith(
      {
        code: administrative.code,
        name: administrative.region_3depth_name,
        fullName: administrative.address_name,
        center: [37.54, 127.05],
      },
      'beauty',
    )
    expect(props.onRegionSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: '행정구역 조회' })).not.toBeInTheDocument()
  })

  it('지역 목록에 없는 행정동도 분석 가능하며 둘러보기는 분석 호출 없이 위치를 전달한다', async () => {
    const external = {
      ...administrative,
      code: '1117065000',
      address_name: '서울특별시 용산구 이태원1동',
    }
    lookup.mockResolvedValue(external)
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    await user.click(screen.getByRole('button', { name: '중심 위치 조회' }))
    expect(await screen.findByText(external.address_name)).toBeInTheDocument()
    expect(screen.queryByText(/지원하지 않는 지역/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이 지역 분석' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '이 지역 선택' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '이 지역 둘러보기' }))
    expect(props.onExploreRegion).toHaveBeenCalledWith(
      expect.objectContaining({
        code: external.code,
        center: [37.54, 127.05],
      }),
    )
    expect(props.analysis.onAnalyze).not.toHaveBeenCalled()
    expect(props.onRegionSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: '행정구역 조회' })).not.toBeInTheDocument()
  })

  it('업종 미선택 분석을 차단하고 업종 목록 오류 중에도 둘러보기를 제공한다', async () => {
    lookup.mockResolvedValue(administrative)
    const user = userEvent.setup()
    const view = render(
      <AreaMap
        {...props}
        analysis={{ ...props.analysis, industryCode: '' }}
      />,
    )
    await user.click(screen.getByRole('button', { name: '중심 위치 조회' }))
    await user.click(await screen.findByRole('button', { name: '이 지역 분석' }))
    expect(screen.getByRole('alert')).toHaveTextContent('분석할 업종')
    expect(props.analysis.onAnalyze).not.toHaveBeenCalled()
    view.rerender(
      <AreaMap
        {...props}
        analysis={{ ...props.analysis, categories: [] }}
      />,
    )
    expect(screen.getByRole('button', { name: '이 지역 분석' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '이 지역 둘러보기' })).toBeEnabled()
  })

  it('행정동 조회 실패를 알리고 같은 좌표를 다시 조회한다', async () => {
    lookup.mockRejectedValueOnce(new Error('행정구역 연결을 확인해 주세요.'))
    lookup.mockResolvedValueOnce(administrative)
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    await user.click(screen.getByRole('button', { name: '중심 위치 조회' }))
    expect(await screen.findByText('행정구역 연결을 확인해 주세요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이 지역 분석' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '행정구역 다시 조회' }))
    expect(await screen.findByText(administrative.address_name)).toBeInTheDocument()
    expect(lookup).toHaveBeenCalledTimes(2)
    expect(lookup).toHaveBeenLastCalledWith([37.54, 127.05], '', expect.any(AbortSignal))
  })

  it('행정동이 없는 위치에서는 분석 버튼 없이 다른 위치 선택을 안내한다', async () => {
    lookup.mockResolvedValue(null)
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    await user.click(screen.getByRole('button', { name: '중심 위치 조회' }))
    expect(await screen.findByText(/이 위치의 행정동을 찾지 못했어요/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이 지역 분석' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이 지역 둘러보기' })).not.toBeInTheDocument()
  })

  it('이전 조회 응답은 최신 위치를 덮어쓰지 않으며 닫으면 요청을 취소한다', async () => {
    let first!: (region: KakaoRegionResult) => void
    let second!: (region: KakaoRegionResult) => void
    lookup.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve
        }),
    )
    lookup.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          second = resolve
        }),
    )
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    act(() => {
      void kakao.onPointSelect?.([37.54, 127.05])
    })
    const firstSignal = lookup.mock.calls[0][2] as AbortSignal
    act(() => {
      void kakao.onPointSelect?.([37.55, 127.06])
    })
    expect(firstSignal.aborted).toBe(true)
    await act(async () => second({ ...administrative, address_name: '최신 행정동' }))
    await act(async () => first({ ...administrative, address_name: '이전 행정동' }))
    expect(screen.getByText('최신 행정동')).toBeInTheDocument()
    expect(screen.queryByText('이전 행정동')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '행정구역 조회 닫기' }))
    expect((lookup.mock.calls[1][2] as AbortSignal).aborted).toBe(true)
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('카카오 단일 지도와 오류 재시도', () => {
  it('카카오지도만 렌더링하고 지도 제공자 선택과 대체 지도 안내를 표시하지 않는다', () => {
    render(<AreaMap {...props} />)
    expect(screen.getByRole('region', { name: '카카오 테스트 지도' })).toBeInTheDocument()
    expect(screen.queryByLabelText('배경지도 선택')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/기본 위치도|OpenStreetMap|별도 타일/)).not.toBeInTheDocument()
    expect(kakao.mounts).toBe(1)
  })

  it('카카오 연결 실패를 오류로 알리고 다시 시도하면 같은 카카오지도를 새로 마운트한다', async () => {
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    await user.click(screen.getByRole('button', { name: '카카오 연결 실패 시뮬레이션' }))
    expect(screen.getByRole('alert')).toHaveTextContent('카카오지도를 불러오지 못했어요.')
    expect(screen.queryByRole('region', { name: '카카오 테스트 지도' })).not.toBeInTheDocument()
    expect(screen.queryByText(/전환했어요|기본 위치도/)).not.toBeInTheDocument()
    expect(kakao.unmounts).toBe(1)
    await user.click(screen.getByRole('button', { name: '카카오지도 다시 시도' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '카카오 테스트 지도' })).toBeInTheDocument()
    expect(kakao.mounts).toBe(2)
    expect(props.onRegionSelect).not.toHaveBeenCalled()
    await user.click(screen.getByText(/표시된 행정동 1곳/))
    expect(screen.getByRole('button', { name: '성수2가1동' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: '성수2가1동' }))
    expect(props.onRegionSelect).toHaveBeenCalledWith(defaultRequest.regionCode)
  })

  it('마운트 중 발생한 카카오 오류도 재시도마다 표시하며 다른 지도로 바꾸지 않는다', async () => {
    kakao.failOnMount = true
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    expect(screen.getByRole('alert')).toHaveTextContent('카카오지도를 불러오지 못했어요.')
    await user.click(screen.getByRole('button', { name: '카카오지도 다시 시도' }))
    expect(screen.getByRole('alert')).toHaveTextContent('카카오지도를 불러오지 못했어요.')
    expect(kakao.mounts).toBe(2)
    expect(screen.queryByLabelText('배경지도 선택')).not.toBeInTheDocument()
    expect(props.analysis.onAnalyze).not.toHaveBeenCalled()
  })

  it('시설 레이어 선택을 카카오 렌더러에 전달한다', async () => {
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    const competitor = props.data.places.find((place) => place.type === 'competitor')!
    const transport = props.data.places.find((place) => place.type === 'transport')!
    expect(screen.getByLabelText('표시 시설')).toHaveTextContent(competitor.name)
    await user.click(screen.getByRole('button', { name: '동종 점포' }))
    expect(screen.getByRole('button', { name: '동종 점포' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByLabelText('표시 시설')).not.toHaveTextContent(competitor.name)
    expect(screen.getByLabelText('표시 시설')).toHaveTextContent(transport.name)
  })
})
