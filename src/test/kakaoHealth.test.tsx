import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KakaoMap } from '../components/KakaoMap'
import type { KakaoMapsApi } from '../lib/kakaoMaps'

const sdk = vi.hoisted(() => ({
  load: vi.fn(),
  handlers: new Map<string, () => void>(),
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
}

beforeEach(() => {
  vi.useFakeTimers()
  props.onFailure.mockClear()
  sdk.handlers.clear()
  sdk.load.mockResolvedValue({
    LatLng,
    Map: class {
      setCenter() {}
      setLevel() {}
      relayout() {}
    },
    CustomOverlay: class {
      setMap() {}
    },
    event: {
      addListener: (_map: unknown, type: string, callback: () => void) =>
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
  return view
}

describe('카카오 타일 상태 확인', () => {
  it('타일 추가 로드가 없는 작은 이동을 지도 실패로 판단하지 않는다', async () => {
    await mount()
    act(() => {
      sdk.handlers.get('tilesloaded')?.()
      sdk.handlers.get('bounds_changed')?.()
      vi.advanceTimersByTime(13_000)
    })
    expect(props.onFailure).not.toHaveBeenCalled()
  })

  it('첫 타일이 무응답이면 제한 시간 후 실패를 알린다', async () => {
    await mount()
    act(() => vi.advanceTimersByTime(12_000))
    expect(props.onFailure).toHaveBeenCalledOnce()
  })

  it('정상 로드 후에도 반복 이미지 오류의 복구를 유지한다', async () => {
    await mount()
    act(() => sdk.handlers.get('tilesloaded')?.())
    const container = screen.getByRole('region', { name: '성수동 카카오지도' })
    const image = document.createElement('img')
    container.append(image)
    act(() => {
      for (let count = 0; count < 3; count++) image.dispatchEvent(new Event('error'))
    })
    expect(props.onFailure).toHaveBeenCalledOnce()
  })

  it('언마운트하면 타이머와 이벤트를 제거한다', async () => {
    const view = await mount()
    view.unmount()
    act(() => vi.advanceTimersByTime(13_000))
    expect(props.onFailure).not.toHaveBeenCalled()
    expect(sdk.handlers.size).toBe(0)
  })
})
