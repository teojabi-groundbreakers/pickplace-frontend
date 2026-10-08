import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KakaoMap } from '../components/KakaoMap'
import type { KakaoMapsApi, KakaoMouseEvent } from '../lib/kakaoMaps'

const sdk = vi.hoisted(() => ({
  load: vi.fn(),
  handlers: new Map<string, (event?: KakaoMouseEvent) => void>(),
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
  sdk.load.mockResolvedValue({
    LatLng,
    Map: class {
      getCenter() {
        return new LatLng(37.55, 127.06)
      }
      setCenter() {}
      setLevel() {}
      getLevel() {
        return 5
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
  render(<KakaoMap {...props} />)
  await act(async () => {
    await Promise.resolve()
  })
}
describe('카카오 지도 이벤트와 상태', () => {
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
