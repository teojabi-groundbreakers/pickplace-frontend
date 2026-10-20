import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KakaoMap } from '../components/KakaoMap'
import type { KakaoMap as KakaoMapInstance, KakaoMapsApi, KakaoMouseEvent } from '../lib/kakaoMaps'
import type { RegionBoundary } from '../types/boundary'
import type { MapRendererProps } from '../types/map'

const sdk = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../lib/kakaoMaps', () => ({ loadKakaoMaps: sdk.load }))

type PolygonOptions = ConstructorParameters<KakaoMapsApi['Polygon']>[0]
type OverlayOptions = ConstructorParameters<KakaoMapsApi['CustomOverlay']>[0]
type EventHandler = (event?: KakaoMouseEvent) => void

class LatLng {
  private latitude: number
  private longitude: number

  constructor(latitude: number, longitude: number) {
    this.latitude = latitude
    this.longitude = longitude
  }

  getLat() {
    return this.latitude
  }

  getLng() {
    return this.longitude
  }
}

class Polygon {
  options: PolygonOptions
  setMap = vi.fn()

  constructor(options: PolygonOptions) {
    this.options = options
    polygonAttempts += 1
    if (polygonAttempts === failingPolygonAttempt) {
      throw new Error('경계 도형 생성 실패')
    }
    polygons.push(this)
  }
}

class CustomOverlay {
  options: OverlayOptions
  setMap = vi.fn((map: KakaoMapInstance | null) => {
    if (!map) this.options.content.remove()
  })

  constructor(options: OverlayOptions) {
    this.options = options
    if (failBoundaryLabel && options.content.className === 'kakao-boundary-label') {
      throw new Error('경계 라벨 생성 실패')
    }
    overlays.push(this)
    mapElement?.append(options.content)
  }
}

const polygons: Polygon[] = []
const overlays: CustomOverlay[] = []
const handlers = new Map<string, Set<EventHandler>>()
const setCenter = vi.fn()
const setBounds = vi.fn()
const addListener = vi.fn()
let mapElement: HTMLElement | null = null
let mapCount = 0
let level = 5
let polygonAttempts = 0
let failingPolygonAttempt = 0
let failBoundaryLabel = false

function emit(type: string, event?: KakaoMouseEvent) {
  handlers.get(type)?.forEach((callback) => callback(event))
}

const setLevel = vi.fn((nextLevel: number) => {
  emit('zoom_start')
  level = nextLevel
  emit('zoom_changed')
})

const boundary: RegionBoundary = {
  regionCode: '1120065000',
  regionType: 'H',
  regionName: '성수1가1동',
  coordinateSystem: 'EPSG:4326',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [127, 37.5],
        [127.1, 37.5],
        [127.1, 37.6],
        [127, 37.5],
      ],
      [
        [127.02, 37.52],
        [127.04, 37.52],
        [127.03, 37.54],
        [127.02, 37.52],
      ],
    ],
  },
  labelPosition: [127.06, 37.55],
  boundaryDate: '2025-06-30',
  source: { name: '테스트 경계', url: 'https://example.com/boundary' },
}

const multiBoundary: RegionBoundary = {
  ...boundary,
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      boundary.geometry.coordinates as [number, number][][],
      [
        [
          [127.2, 37.7],
          [127.25, 37.7],
          [127.2, 37.75],
          [127.2, 37.7],
        ],
      ],
    ],
  },
}

function createProps(overrides: Partial<MapRendererProps> = {}): MapRendererProps {
  return {
    data: {
      center: [37.54, 127.05],
      boundary: [],
      places: [],
      regionName: '성수동',
      isDemo: false,
    },
    regions: [],
    selectedRegionCode: '',
    onRegionSelect: vi.fn(),
    onFailure: vi.fn(),
    onBoundaryFailure: vi.fn(),
    onPointSelect: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  polygons.length = 0
  overlays.length = 0
  handlers.clear()
  mapElement = null
  mapCount = 0
  level = 5
  polygonAttempts = 0
  failingPolygonAttempt = 0
  failBoundaryLabel = false
  setCenter.mockClear()
  setBounds.mockClear()
  setLevel.mockClear()
  addListener.mockReset().mockImplementation((_map, type: string, callback: EventHandler) => {
    const callbacks = handlers.get(type) ?? new Set<EventHandler>()
    callbacks.add(callback)
    handlers.set(type, callbacks)
  })
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
    LatLngBounds: class {
      extend() {}
    },
    Map: class {
      constructor(element: HTMLElement) {
        mapElement = element
        mapCount += 1
      }

      getCenter() {
        return new LatLng(37.54, 127.05)
      }

      getLevel() {
        return level
      }

      getProjection() {
        return { coordsFromContainerPoint: () => new LatLng(37.54, 127.05) }
      }

      setCenter = setCenter
      setLevel = setLevel
      setBounds = setBounds

      relayout() {}
    },
    Polygon,
    CustomOverlay,
    event: {
      addListener,
      removeListener: (_map: unknown, type: string, callback: EventHandler) => {
        handlers.get(type)?.delete(callback)
      },
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
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount(props: MapRendererProps) {
  const view = render(<KakaoMap {...props} />)
  await act(async () => {
    await Promise.resolve()
  })
  act(() => emit('tilesloaded'))
  return view
}

function boundaryLabels() {
  return overlays.filter((overlay) => overlay.options.content.className === 'kakao-boundary-label')
}

describe('카카오 행정동 경계 표시', () => {
  it('외곽선과 구멍을 유지하고 GeoJSON 좌표 순서를 카카오 좌표로 변환한다', async () => {
    const props = createProps({ administrativeBoundary: boundary })
    await mount(props)

    expect(polygons).toHaveLength(1)
    expect(polygons[0].options.path).toEqual([
      [
        new LatLng(37.5, 127),
        new LatLng(37.5, 127.1),
        new LatLng(37.6, 127.1),
        new LatLng(37.5, 127),
      ],
      [
        new LatLng(37.52, 127.02),
        new LatLng(37.52, 127.04),
        new LatLng(37.54, 127.03),
        new LatLng(37.52, 127.02),
      ],
    ])
    expect(polygons[0].options).not.toHaveProperty('clickable')
    expect(props.onBoundaryFailure).not.toHaveBeenCalled()
  })

  it('복수 폴리곤을 각각 그리고 기존 분석 링보다 우선한다', async () => {
    const props = createProps({ administrativeBoundary: multiBoundary })
    props.data.boundary = [
      [37.4, 127],
      [37.4, 127.1],
      [37.5, 127],
    ]
    await mount(props)

    expect(polygons).toHaveLength(2)
    expect(polygons[0].options.path).toHaveLength(2)
    expect(polygons[1].options.path).toEqual([
      [
        new LatLng(37.7, 127.2),
        new LatLng(37.7, 127.25),
        new LatLng(37.75, 127.2),
        new LatLng(37.7, 127.2),
      ],
    ])
    expect(boundaryLabels()).toHaveLength(1)
  })

  it('서버 지역명은 표시 전용 텍스트 라벨로 만들고 대표점 좌표 순서를 변환한다', async () => {
    await mount(
      createProps({ administrativeBoundary: { ...boundary, regionName: '<b>성수1가1동</b>' } }),
    )

    const label = boundaryLabels()[0].options
    expect(label.content.textContent).toBe('<b>성수1가1동</b>')
    expect(label.content.querySelector('b')).toBeNull()
    expect(label.content.style.pointerEvents).toBe('none')
    expect(label.clickable).toBe(false)
    expect(label.position).toEqual(new LatLng(37.55, 127.06))
  })

  it('경계 응답 갱신은 이전 도형·라벨만 제거하며 지도 배율이나 중심을 바꾸지 않는다', async () => {
    const props = createProps({ administrativeBoundary: boundary })
    const view = await mount(props)
    const previousPolygon = polygons[0]
    const previousLabel = boundaryLabels()[0]
    const centerMarker = overlays.find(
      (overlay) => overlay.options.content.className === 'kakao-center-marker',
    )!
    const initialListenerCount = addListener.mock.calls.length
    setCenter.mockClear()
    setBounds.mockClear()
    setLevel.mockClear()

    view.rerender(
      <KakaoMap
        {...props}
        administrativeBoundary={multiBoundary}
      />,
    )

    expect(previousPolygon.setMap).toHaveBeenCalledExactlyOnceWith(null)
    expect(previousLabel.setMap).toHaveBeenCalledExactlyOnceWith(null)
    expect(centerMarker.setMap).not.toHaveBeenCalled()
    expect(mapCount).toBe(1)
    expect(addListener).toHaveBeenCalledTimes(initialListenerCount)
    expect(setCenter).not.toHaveBeenCalled()
    expect(setBounds).not.toHaveBeenCalled()
    expect(setLevel).not.toHaveBeenCalled()
  })

  it('행정동 경계가 없으면 기존 분석 단일 링 표시와 숨김 설정을 유지한다', async () => {
    const props = createProps({ hideAnalysisBoundary: true })
    props.data.boundary = [
      [37.5, 127],
      [37.5, 127.1],
      [37.6, 127.1],
    ]
    const view = await mount(props)
    expect(polygons).toHaveLength(0)

    view.rerender(
      <KakaoMap
        {...props}
        hideAnalysisBoundary={false}
      />,
    )
    expect(polygons).toHaveLength(1)
    expect(polygons[0].options.path).toEqual([
      new LatLng(37.5, 127),
      new LatLng(37.5, 127.1),
      new LatLng(37.6, 127.1),
    ])
    expect(boundaryLabels()).toHaveLength(0)
  })

  it('행정동 경계를 지우면 모든 분리 도형과 라벨을 제거한다', async () => {
    const props = createProps({ administrativeBoundary: multiBoundary, hideAnalysisBoundary: true })
    const view = await mount(props)
    const previousPolygons = [...polygons]
    const previousLabel = boundaryLabels()[0]

    view.rerender(
      <KakaoMap
        {...props}
        administrativeBoundary={null}
      />,
    )

    previousPolygons.forEach((polygon) => {
      expect(polygon.setMap).toHaveBeenCalledExactlyOnceWith(null)
    })
    expect(previousLabel.setMap).toHaveBeenCalledExactlyOnceWith(null)
    expect(screen.queryByText(boundary.regionName)).not.toBeInTheDocument()
  })

  it('경계 추가 후에도 우클릭 조회와 라벨 위 휠을 한 번만 처리한다', async () => {
    const props = createProps()
    const view = await mount(props)
    view.rerender(
      <KakaoMap
        {...props}
        administrativeBoundary={boundary}
      />,
    )
    setLevel.mockClear()
    const label = boundaryLabels()[0].options.content
    const labelWheel = vi.fn()
    label.addEventListener('wheel', labelWheel)
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -40,
      clientX: 100,
      clientY: 100,
    })

    act(() => {
      emit('rightclick', { latLng: new LatLng(37.55, 127.06) })
      label.dispatchEvent(event)
    })

    expect(props.onPointSelect).toHaveBeenCalledExactlyOnceWith([37.55, 127.06])
    expect(handlers.get('rightclick')?.size).toBe(1)
    expect(event.defaultPrevented).toBe(true)
    expect(labelWheel).not.toHaveBeenCalled()
    expect(setLevel).toHaveBeenCalledOnce()
    expect(setLevel).toHaveBeenCalledWith(4, {
      anchor: new LatLng(37.54, 127.05),
      animate: { duration: 200 },
    })
    expect(props.onFailure).not.toHaveBeenCalled()
  })

  it('복수 도형 생성 중 실패하면 만든 경계만 정리하고 지도 조회를 유지한다', async () => {
    failingPolygonAttempt = 2
    const props = createProps({ administrativeBoundary: multiBoundary })
    await mount(props)

    expect(polygons).toHaveLength(1)
    expect(polygons[0].setMap).toHaveBeenCalledExactlyOnceWith(null)
    expect(boundaryLabels()).toHaveLength(0)
    expect(props.onBoundaryFailure).toHaveBeenCalledOnce()
    expect(props.onFailure).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: '성수동 카카오지도' })).toBeInTheDocument()
    act(() => emit('rightclick', { latLng: new LatLng(37.55, 127.06) }))
    expect(props.onPointSelect).toHaveBeenCalledExactlyOnceWith([37.55, 127.06])
  })

  it('경계 라벨 생성 실패도 만든 모든 폴리곤을 정리하고 전체 지도 오류로 전파하지 않는다', async () => {
    failBoundaryLabel = true
    const props = createProps({ administrativeBoundary: multiBoundary })
    const view = await mount(props)

    expect(polygons).toHaveLength(2)
    polygons.forEach((polygon) => {
      expect(polygon.setMap).toHaveBeenCalledExactlyOnceWith(null)
    })
    expect(props.onBoundaryFailure).toHaveBeenCalledOnce()
    expect(props.onFailure).not.toHaveBeenCalled()

    view.unmount()
    polygons.forEach((polygon) => {
      expect(polygon.setMap).toHaveBeenCalledOnce()
    })
  })

  it('기존 분석 링 렌더링 실패는 기존 전체 지도 오류 처리로 전달한다', async () => {
    failingPolygonAttempt = 1
    const props = createProps()
    props.data.boundary = [
      [37.5, 127],
      [37.5, 127.1],
      [37.6, 127.1],
    ]
    await mount(props)

    expect(props.onFailure).toHaveBeenCalledOnce()
    expect(props.onBoundaryFailure).not.toHaveBeenCalled()
  })

  it('언마운트 시 모든 경계 도형·라벨과 지도 이벤트를 제거한다', async () => {
    const view = await mount(createProps({ administrativeBoundary: multiBoundary }))
    const activeLabel = boundaryLabels()[0]
    view.unmount()

    polygons.forEach((polygon) => {
      expect(polygon.setMap).toHaveBeenCalledExactlyOnceWith(null)
    })
    expect(activeLabel.setMap).toHaveBeenCalledExactlyOnceWith(null)
    handlers.forEach((callbacks) => expect(callbacks.size).toBe(0))
  })
})
