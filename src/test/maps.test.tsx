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
import { createDemoAnalysis, defaultRequest } from '../data/demo'

const tiles = vi.hoisted(() => ({
  handlers: null as Record<string, () => void> | null,
  immediateSuccess: false,
}))
vi.mock('react-leaflet', async () => {
  const { useEffect } = await import('react')
  const map = {
    invalidateSize: vi.fn(),
    getContainer: () => document.createElement('div'),
    fitBounds: vi.fn(),
    setView: vi.fn(),
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
    useMap: () => map,
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
}
beforeEach(() => {
  tiles.immediateSuccess = false
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
