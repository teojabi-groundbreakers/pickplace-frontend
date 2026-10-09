import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KakaoMap } from '../components/KakaoMap'
import type { KakaoMapsApi, KakaoMouseEvent } from '../lib/kakaoMaps'

const sdk = vi.hoisted(() => ({
  load: vi.fn(),
  handlers: new Map<string, (event?: KakaoMouseEvent) => void>(),
  level: 5,
  setLevel: vi.fn(),
  setCenter: vi.fn(),
  project: vi.fn(),
}))
vi.mock('../lib/kakaoMaps', () => ({ loadKakaoMaps: sdk.load }))
class LatLng {
  private lat: number
  private lng: number

  constructor(lat: number, lng: number) {
    this.lat = lat
    this.lng = lng
  }
  getLat() {
    return this.lat
  }
  getLng() {
    return this.lng
  }
}
const props = {
  data: {
    center: [37.54, 127.05] as [number, number],
    boundary: [],
    places: [],
    regionName: '성수동',
    isDemo: false,
  },
  regions: [],
  selectedRegionCode: '',
  onRegionSelect: vi.fn(),
  onFailure: vi.fn(),
  onPointSelect: vi.fn(),
}
beforeEach(() => {
  vi.useFakeTimers()
  props.onFailure.mockClear()
  props.onPointSelect.mockClear()
  sdk.handlers.clear()
  sdk.level = 5
  sdk.setCenter.mockClear()
  sdk.setLevel.mockReset().mockImplementation((level: number) => {
    sdk.level = level
  })
  sdk.project.mockReset().mockReturnValue(new LatLng(37.56, 127.07))
  sdk.load.mockResolvedValue({
    LatLng,
    Point: class {
      x: number
      y: number

      constructor(x: number, y: number) {
        this.x = x
        this.y = y
      }
    },
    Map: class {
      getCenter() {
        return new LatLng(37.55, 127.06)
      }
      setCenter = sdk.setCenter
      setLevel = sdk.setLevel
      getLevel() {
        return sdk.level
      }
      getProjection() {
        return { coordsFromContainerPoint: sdk.project }
      }
      relayout() {}
    },
    CustomOverlay: class {
      setMap() {}
    },
    event: {
      addListener: (_map: unknown, type: string, callback: (event?: KakaoMouseEvent) => void) =>
        sdk.handlers.set(type, callback),
      removeListener: (_map: unknown, type: string) => sdk.handlers.delete(type),
    },
  } as unknown as KakaoMapsApi)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
async function mount() {
  const view = render(<KakaoMap {...props} />)
  await act(async () => {
    await Promise.resolve()
  })
  sdk.setLevel.mockClear()
  return view
}

function wheel(target: HTMLElement, options: WheelEventInit) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...options,
  })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}
describe('카카오 지도 이벤트와 상태', () => {
  it('둘러보기는 클릭 위치로 확대하고 이미 더 확대된 배율은 유지한다', async () => {
    const view = await mount()
    const region = {
      code: '1117065000',
      name: '이태원1동',
      fullName: '서울특별시 용산구 이태원1동',
      center: [37.53213, 126.99267] as [number, number],
    }
    view.rerender(
      <KakaoMap
        {...props}
        exploreRegion={region}
      />,
    )
    expect(sdk.setCenter).toHaveBeenLastCalledWith(new LatLng(...region.center))
    expect(sdk.level).toBe(3)
    sdk.level = 2
    view.rerender(
      <KakaoMap
        {...props}
        exploreRegion={{ ...region }}
      />,
    )
    expect(sdk.level).toBe(2)
    expect(props.onPointSelect).not.toHaveBeenCalled()
  })

  it('작은 트랙패드 입력을 누적해 포인터 위치 기준으로 확대하고 페이지 스크롤을 막는다', async () => {
    await mount()
    const map = screen.getByRole('region', { name: '성수동 카카오지도' })
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({ left: 50, top: 30 } as DOMRect)
    const tile = document.createElement('div')
    map.append(tile)
    const sdkWheel = vi.fn()
    tile.addEventListener('wheel', sdkWheel)

    for (let i = 0; i < 80; i++) {
      const event = wheel(tile, { deltaY: -0.5, clientX: 200, clientY: 130 })
      expect(event.defaultPrevented).toBe(true)
    }

    expect(sdk.setLevel).toHaveBeenCalledOnce()
    expect(sdk.setLevel).toHaveBeenCalledWith(4, { anchor: new LatLng(37.56, 127.07) })
    expect(sdk.project).toHaveBeenCalledWith({ x: 150, y: 100 })
    expect(sdkWheel).not.toHaveBeenCalled()
  })

  it.each([
    { deltaY: 100, deltaMode: 0 },
    { deltaY: 3, deltaMode: 1 },
    { deltaY: 1, deltaMode: 2 },
  ])('픽셀·줄·페이지 단위 입력으로 축소한다: $deltaMode', async (options) => {
    await mount()
    const map = screen.getByRole('region', { name: '성수동 카카오지도' })
    wheel(map, options)
    expect(sdk.setLevel).toHaveBeenCalledOnce()
    expect(sdk.setLevel).toHaveBeenCalledWith(6, { anchor: new LatLng(37.56, 127.07) })
  })

  it('연속 관성 입력의 확대 속도를 제한하고 방향 전환과 입력 중단 시 누적값을 초기화한다', async () => {
    await mount()
    const map = screen.getByRole('region', { name: '성수동 카카오지도' })
    wheel(map, { deltaY: 30 })
    wheel(map, { deltaY: -30 })
    expect(sdk.setLevel).not.toHaveBeenCalled()
    wheel(map, { deltaY: -10 })
    expect(sdk.level).toBe(4)
    wheel(map, { deltaY: -100 })
    expect(sdk.setLevel).toHaveBeenCalledOnce()

    act(() => vi.advanceTimersByTime(200))
    wheel(map, { deltaY: 30 })
    act(() => vi.advanceTimersByTime(200))
    wheel(map, { deltaY: 10 })
    expect(sdk.setLevel).toHaveBeenCalledOnce()
    wheel(map, { deltaY: 30 })
    expect(sdk.level).toBe(5)
  })

  it('최대·최소 배율과 수평 스크롤에서도 페이지로 입력을 넘기지 않는다', async () => {
    await mount()
    const map = screen.getByRole('region', { name: '성수동 카카오지도' })
    sdk.level = 1
    expect(wheel(map, { deltaY: -100 }).defaultPrevented).toBe(true)
    act(() => vi.advanceTimersByTime(200))
    sdk.level = 14
    expect(wheel(map, { deltaY: 100 }).defaultPrevented).toBe(true)
    expect(wheel(map, { deltaX: 100, deltaY: 1 }).defaultPrevented).toBe(true)
    expect(sdk.setLevel).not.toHaveBeenCalled()
  })

  it('지도 밖 패널의 스크롤은 유지하고 언마운트 시 휠 처리를 제거한다', async () => {
    const view = await mount()
    const map = screen.getByRole('region', { name: '성수동 카카오지도' })
    const panel = document.createElement('div')
    view.container.append(panel)
    const panelWheel = vi.fn()
    panel.addEventListener('wheel', panelWheel)
    expect(wheel(panel, { deltaY: 100 }).defaultPrevented).toBe(false)
    expect(panelWheel).toHaveBeenCalledOnce()

    view.unmount()
    expect(wheel(map, { deltaY: 100 }).defaultPrevented).toBe(false)
    expect(sdk.setLevel).not.toHaveBeenCalled()
  })

  it('첫 타일이 무응답이면 대체 지도로 복구한다', async () => {
    await mount()
    act(() => vi.advanceTimersByTime(12_000))
    expect(props.onFailure).toHaveBeenCalledOnce()
  })
  it('우클릭 좌표와 중심 위치 좌표를 구분하고 언마운트 시 이벤트를 제거한다', async () => {
    const view = render(<KakaoMap {...props} />)
    await act(async () => {
      await Promise.resolve()
    })
    act(() => sdk.handlers.get('rightclick')?.({ latLng: new LatLng(37.56, 127.07) }))
    expect(props.onPointSelect).toHaveBeenLastCalledWith([37.56, 127.07])
    act(() => screen.getByRole('button', { name: '중심 위치 조회' }).click())
    expect(props.onPointSelect).toHaveBeenLastCalledWith([37.55, 127.06])
    view.unmount()
    expect(sdk.handlers.has('rightclick')).toBe(false)
    act(() => vi.advanceTimersByTime(13_000))
    expect(props.onFailure).not.toHaveBeenCalled()
  })
})
