import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoundaryGeometry, RegionBoundary } from '../types/boundary'
import { config } from '../lib/config'
import {
  geometryToMapPolygons,
  getRegionBoundary,
  isBoundaryGeometry,
  isRegionBoundary,
} from '../lib/regionBoundary'

const regionCode = '1120067000'
const outer = [
  [127, 37],
  [127.1, 37],
  [127.1, 37.1],
  [127, 37],
] satisfies [number, number][]
const hole = [
  [127.02, 37.02],
  [127.04, 37.03],
  [127.02, 37.04],
  [127.02, 37.02],
] satisfies [number, number][]

function example(): RegionBoundary {
  return {
    regionCode,
    regionType: 'H',
    regionName: '경계 형식 확인용 행정동',
    coordinateSystem: 'EPSG:4326',
    geometry: { type: 'Polygon', coordinates: [outer, hole] },
    labelPosition: [127.05, 37.05],
    boundaryDate: '2025-06-30',
    source: { name: '테스트 경계 자료', url: 'https://example.com/boundaries' },
  }
}

const fetchMock = vi.fn()
const initialConfig = { demoMode: config.demoMode, apiBaseUrl: config.apiBaseUrl }

beforeEach(() => {
  config.demoMode = false
  config.apiBaseUrl = '/api'
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  Object.assign(config, initialConfig)
  vi.unstubAllGlobals()
})

describe('행정동 경계 형식과 지도 좌표 변환', () => {
  it('Polygon의 외곽선·구멍과 MultiPolygon을 모두 수용한다', () => {
    expect(isRegionBoundary(example())).toBe(true)
    expect(
      isRegionBoundary({
        ...example(),
        geometry: { type: 'MultiPolygon', coordinates: [[outer, hole], [outer]] },
      }),
    ).toBe(true)
  })

  it('모든 폴리곤·구멍을 보존해 경도/위도만 지도 위도/경도 순서로 바꾼다', () => {
    const geometry: BoundaryGeometry = {
      type: 'MultiPolygon',
      coordinates: [[outer, hole], [outer]],
    }
    const before = structuredClone(geometry)

    expect(geometryToMapPolygons(geometry)).toEqual([
      [
        [
          [37, 127],
          [37, 127.1],
          [37.1, 127.1],
          [37, 127],
        ],
        [
          [37.02, 127.02],
          [37.03, 127.04],
          [37.04, 127.02],
          [37.02, 127.02],
        ],
      ],
      [
        [
          [37, 127],
          [37, 127.1],
          [37.1, 127.1],
          [37, 127],
        ],
      ],
    ])
    expect(geometryToMapPolygons(example().geometry)).toHaveLength(1)
    expect(geometry).toEqual(before)
  })

  it.each([
    { name: '8자리 코드', change: { regionCode: '11200670' } },
    { name: '법정동 종류', change: { regionType: 'B' } },
    { name: '다른 좌표계', change: { coordinateSystem: 'EPSG:5179' } },
    { name: '빈 지역명', change: { regionName: ' ' } },
    { name: '위경도를 뒤집은 라벨', change: { labelPosition: [37.05, 127.05] } },
    { name: '없는 날짜', change: { boundaryDate: '2025-02-30' } },
    { name: '날짜가 아닌 연도', change: { boundaryDate: '2025' } },
    { name: '빈 출처명', change: { source: { name: '', url: 'https://example.com' } } },
    { name: '실행 가능한 URL', change: { source: { name: '자료', url: 'javascript:alert(1)' } } },
    { name: '상대 URL', change: { source: { name: '자료', url: '/boundaries' } } },
  ])('$name 응답을 거부한다', ({ change }) => {
    expect(isRegionBoundary({ ...example(), ...change })).toBe(false)
  })

  it.each([
    { name: '빈 Polygon', geometry: { type: 'Polygon', coordinates: [] } },
    { name: '빈 MultiPolygon', geometry: { type: 'MultiPolygon', coordinates: [] } },
    {
      name: '비어 있는 내부 폴리곤',
      geometry: { type: 'MultiPolygon', coordinates: [[outer], []] },
    },
    {
      name: '닫히지 않은 링',
      geometry: { type: 'Polygon', coordinates: [[...outer.slice(0, 3), [127, 37.1]]] },
    },
    {
      name: '서로 다른 점이 2개뿐인 링',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [127, 37],
            [127.1, 37],
            [127, 37],
            [127, 37],
          ],
        ],
      },
    },
    {
      name: '범위 밖 경도',
      geometry: { type: 'Polygon', coordinates: [[[181, 37], ...outer.slice(1)]] },
    },
    {
      name: '숫자가 아닌 좌표',
      geometry: { type: 'Polygon', coordinates: [[['127', 37], ...outer.slice(1)]] },
    },
    {
      name: '무한대 좌표',
      geometry: { type: 'Polygon', coordinates: [[[127, Infinity], ...outer.slice(1)]] },
    },
    { name: '지원하지 않는 도형', geometry: { type: 'Point', coordinates: [127, 37] } },
  ])('$name 형상을 거부한다', ({ geometry }) => {
    expect(isBoundaryGeometry(geometry)).toBe(false)
  })
})

describe('독립 경계 API', () => {
  it('원본 10자리 H 코드 경로로 요청하고 검증한 전체 경계를 반환한다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(example())))
    const controller = new AbortController()

    expect(await getRegionBoundary(regionCode, controller.signal)).toEqual(example())
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/regions/${regionCode}/boundary`,
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('데모 모드에서는 합성 경계나 네트워크 요청 없이 null을 반환한다', async () => {
    config.demoMode = true

    expect(await getRegionBoundary(regionCode)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['11200670', '', '1120067000/other'])(
    '유효하지 않은 코드 %s는 요청하지 않는다',
    async (code) => {
      await expect(getRegionBoundary(code)).rejects.toMatchObject({ code: 'INVALID_REGION_CODE' })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('404와 BOUNDARY_NOT_AVAILABLE이 함께 온 경우에만 경계 없음으로 처리한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'BOUNDARY_NOT_AVAILABLE' }), { status: 404 }),
    )
    expect(await getRegionBoundary(regionCode)).toBeNull()

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 }),
    )
    await expect(getRegionBoundary(regionCode)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'BOUNDARY_NOT_AVAILABLE' }), { status: 503 }),
    )
    await expect(getRegionBoundary(regionCode)).rejects.toMatchObject({ status: 503 })
  })

  it('다른 지역의 정상 형식 응답과 잘못된 CRS 응답을 거부한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...example(), regionCode: '1117065000' })),
    )
    await expect(getRegionBoundary(regionCode)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...example(), coordinateSystem: 'EPSG:5179' })),
    )
    await expect(getRegionBoundary(regionCode)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('응답 없는 204와 JSON이 아닌 개발 서버 응답을 경계 없음으로 숨기지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(getRegionBoundary(regionCode)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    fetchMock.mockResolvedValueOnce(new Response('<html>FE</html>'))
    await expect(getRegionBoundary(regionCode)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('타임아웃·네트워크 오류를 보존하고 호출자 취소는 일반 오류로 바꾸지 않는다', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError'))
    await expect(getRegionBoundary(regionCode)).rejects.toMatchObject({ code: 'TIMEOUT' })

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(getRegionBoundary(regionCode)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    const controller = new AbortController()
    controller.abort()
    const cancellation = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValueOnce(cancellation)
    await expect(getRegionBoundary(regionCode, controller.signal)).rejects.toBe(cancellation)
  })
})
