import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AreaMap } from '../components/AreaMap'
import {
  getMapProviders,
  initialMapProvider,
  mapSettings,
  nextMapProvider,
} from '../lib/mapProviders'
import type { MapRendererProps } from '../types/map'
import { createDemoAnalysis, defaultRequest, demoCatalog } from '../data/demo'
import type { KakaoRegionResult } from '../lib/kakaoMaps'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('../lib/regionLookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionLookup')>()),
  lookupAdministrativeRegion: lookup,
}))

const tiles = vi.hoisted(() => ({
  handlers: null as Record<string, () => void> | null,
  immediateSuccess: false,
  contextmenu: null as ((event: { latlng: { lat: number; lng: number } }) => void) | null,
  setView: vi.fn(),
}))
vi.mock('react-leaflet', async () => {
  const { useEffect } = await import('react')
  const map = {
    invalidateSize: vi.fn(),
    getContainer: () => document.createElement('div'),
    fitBounds: vi.fn(),
    setView: tiles.setView,
    getZoom: () => 14,
    getCenter: () => ({ lat: 37.54, lng: 127.05 }),
  }
  return {
    MapContainer: ({ children, className }: { children: ReactNode; className: string }) => (
      <div
        className={className}
        data-testid="leaflet-map"
      >
        {children}
      </div>
    ),
    TileLayer: ({
      url,
      eventHandlers,
    }: {
      url: string
      eventHandlers: Record<string, () => void>
    }) => {
      tiles.handlers = eventHandlers
      useEffect(() => {
        if (tiles.immediateSuccess) {
          eventHandlers.loading()
          eventHandlers.tileload()
          eventHandlers.load()
        }
      }, [eventHandlers])
      return <span data-testid="tile-source">{url}</span>
    },
    Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CircleMarker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Polygon: () => <span data-testid="boundary" />,
    Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    useMapEvents: (handlers: { contextmenu: typeof tiles.contextmenu }) => {
      tiles.contextmenu = handlers.contextmenu
      return map
    },
  }
})
vi.mock('../components/KakaoMap', () => ({
  KakaoMap: ({ onFailure }: MapRendererProps) => (
    <button onClick={onFailure}>카카오 연결 실패 시뮬레이션</button>
  ),
}))

const originalSettings = { ...mapSettings }
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
  tiles.immediateSuccess = false
  tiles.setView.mockClear()
  Object.assign(mapSettings, originalSettings, {
    preferred: 'osm',
    kakaoAppKey: '',
    tileUrl: '',
    tileAttribution: '',
  })
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
  it('둘러보기 좌표를 우선 확대하고 이전 분석 경계에 맞춰 돌아가지 않는다', () => {
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
    expect(tiles.setView).toHaveBeenLastCalledWith(region.center, 17)
    expect(props.analysis.onAnalyze).not.toHaveBeenCalled()
  })

  it('우클릭한 행정동 코드와 선택 업종으로 분석하며 지역 선택 버튼을 대체한다', async () => {
    lookup.mockResolvedValue(administrative)
    const user = userEvent.setup()
    const view = render(<AreaMap {...props} />)
    await act(async () => tiles.contextmenu?.({ latlng: { lat: 37.54, lng: 127.05 } }))
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
      void tiles.contextmenu?.({ latlng: { lat: 37.54, lng: 127.05 } })
    })
    const firstSignal = lookup.mock.calls[0][2] as AbortSignal
    act(() => {
      void tiles.contextmenu?.({ latlng: { lat: 37.55, lng: 127.06 } })
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
  Object.assign(mapSettings, originalSettings)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('지도 제공자 선택', () => {
  it('설정된 카카오지도를 우선 사용하고 명시한 공급자의 키가 없으면 위치도를 사용한다', () => {
    const providers = getMapProviders({ ...mapSettings, kakaoAppKey: 'test-browser-key' })
    expect(initialMapProvider(providers, 'auto')).toBe('kakao')
    expect(initialMapProvider(getMapProviders(), 'kakao')).toBe('schematic')
    expect(nextMapProvider(providers, ['kakao'])).toBe('schematic')
  })
  it('별도 타일은 HTTPS/동일 출처 XYZ URL과 출처 표기가 모두 필요하다', () => {
    const configured = {
      ...mapSettings,
      tileUrl: '/tiles/{z}/{x}/{y}.png',
      tileAttribution: 'Licensed tiles',
    }
    expect(initialMapProvider(getMapProviders(configured), 'auto')).toBe('custom')
    expect(nextMapProvider(getMapProviders(configured), ['osm'])).toBe('custom')
    expect(
      getMapProviders({ ...configured, tileAttribution: '' }).find(
        (provider) => provider.id === 'custom',
      )?.available,
    ).toBe(false)
    expect(
      getMapProviders({ ...configured, tileUrl: 'javascript:alert(1)' }).find(
        (provider) => provider.id === 'custom',
      )?.available,
    ).toBe(false)
  })
})

describe('지도 장애 복구', () => {
  it('마운트 직후 캐시 타일 로드가 완료되어도 타임아웃을 남기지 않는다', () => {
    vi.useFakeTimers()
    tiles.immediateSuccess = true
    render(<AreaMap {...props} />)
    act(() => vi.advanceTimersByTime(13_000))
    expect(screen.getByLabelText('배경지도 선택')).toHaveValue('osm')
  })

  it('OSM 타일 오류가 반복되면 외부 요청 없는 위치도로 전환하고 선택을 유지한다', async () => {
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    expect(screen.getByTestId('tile-source')).toHaveTextContent('tile.openstreetmap.org')
    act(() => {
      tiles.handlers?.loading()
      tiles.handlers?.tileerror()
      tiles.handlers?.tileerror()
      tiles.handlers?.tileerror()
      tiles.handlers?.load()
    })
    expect(screen.getByLabelText('배경지도 선택')).toHaveValue('schematic')
    expect(screen.queryByTestId('tile-source')).not.toBeInTheDocument()
    expect(screen.getByTestId('boundary')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('지역 선택과 분석은 계속할 수 있습니다')
    await user.click(screen.getByText(/표시된 행정동 1곳/))
    expect(screen.getByRole('button', { name: '성수2가1동' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: '성수2가1동' }))
    expect(props.onRegionSelect).toHaveBeenCalledWith(defaultRequest.regionCode)
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(screen.getByLabelText('배경지도 선택')).toHaveValue('osm')
  })
  it('응답이 멈춘 타일은 제한 시간 후 복구하며 정상 타일은 전환하지 않는다', () => {
    vi.useFakeTimers()
    render(<AreaMap {...props} />)
    act(() => {
      tiles.handlers?.loading()
      tiles.handlers?.tileload()
      tiles.handlers?.load()
      vi.advanceTimersByTime(13_000)
    })
    expect(screen.getByLabelText('배경지도 선택')).toHaveValue('osm')
    act(() => {
      tiles.handlers?.loading()
      vi.advanceTimersByTime(12_000)
    })
    expect(screen.getByLabelText('배경지도 선택')).toHaveValue('schematic')
  })
  it('카카오 실패 시 허가된 별도 타일을 사용하고, 다시 실패하면 위치도로 전환한다', async () => {
    Object.assign(mapSettings, {
      preferred: 'kakao',
      kakaoAppKey: 'test-browser-key',
      tileUrl: '/tiles/{z}/{x}/{y}.png',
      tileAttribution: 'Licensed tiles',
    })
    const user = userEvent.setup()
    render(<AreaMap {...props} />)
    await user.click(screen.getByRole('button', { name: '카카오 연결 실패 시뮬레이션' }))
    expect(screen.getByLabelText('배경지도 선택')).toHaveValue('custom')
    act(() => {
      tiles.handlers?.loading()
      tiles.handlers?.tileerror()
      tiles.handlers?.load()
    })
    expect(screen.getByLabelText('배경지도 선택')).toHaveValue('schematic')
  })
})
