import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { locateReferenceDistrict, locateReferenceDong } from '../lib/locateReferenceDong'
import type { KakaoRegionResult } from '../lib/kakaoMaps'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  keywordSearch: vi.fn(),
  lookup: vi.fn(),
}))

vi.mock('../lib/kakaoMaps', () => ({ loadKakaoMaps: mocks.load }))
vi.mock('../lib/regionLookup', () => ({ lookupAdministrativeRegion: mocks.lookup }))

const region: KakaoRegionResult = {
  region_type: 'H',
  code: '1156070000',
  address_name: '서울특별시 영등포구 대림제1동',
  region_1depth_name: '서울특별시',
  region_2depth_name: '영등포구',
  region_3depth_name: '대림제1동',
}
const center = { place_name: '대림1동 주민센터', x: '126.898', y: '37.493' }
const invoke = (signal = new AbortController().signal) =>
  locateReferenceDong('영등포구', '대림1동', '1156070000', '대림제1동', 'test-key', signal)

beforeEach(() => {
  mocks.load.mockReset().mockResolvedValue({
    services: {
      Places: class {
        keywordSearch = mocks.keywordSearch
      },
    },
  })
  mocks.keywordSearch.mockReset().mockImplementation((_query, callback) => callback([center], 'OK'))
  mocks.lookup.mockReset().mockResolvedValue(region)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BE 행정동의 실제 위치 조회', () => {
  it('공식 H10과 역조회 H10이 일치하면 원천명과 공식명이 달라도 실제 좌표를 반환한다', async () => {
    await expect(invoke()).resolves.toEqual({
      region,
      center: [37.493, 126.898],
      placeName: '대림1동 주민센터',
    })
    expect(mocks.lookup).toHaveBeenCalledWith(
      [37.493, 126.898],
      'test-key',
      expect.any(AbortSignal),
    )
    expect(mocks.keywordSearch).toHaveBeenCalledWith(
      '서울특별시 영등포구 대림1동 주민센터',
      expect.any(Function),
      { size: 3 },
    )
  })

  it('동명이 같아도 공식 H10이 다르거나 서울/구가 다르면 후보를 거부한다', async () => {
    mocks.lookup.mockResolvedValue({ ...region, code: '1156068000', region_3depth_name: '대림1동' })
    await expect(invoke()).rejects.toMatchObject({ code: 'MISMATCH' })
    mocks.lookup.mockResolvedValue({ ...region, region_2depth_name: '구로구' })
    await expect(invoke()).rejects.toMatchObject({ code: 'MISMATCH' })
  })

  it('선택한 시도와 시 산하 구를 검색하고 역조회한 H10 및 소속을 확인한다', async () => {
    const otherRegion: KakaoRegionResult = {
      ...region,
      code: '9999999999',
      address_name: '경기도 수원시 장안구 가상동',
      region_1depth_name: '경기도',
      region_2depth_name: '수원시 장안구',
      region_3depth_name: '가상동',
    }
    mocks.lookup.mockResolvedValue(otherRegion)
    const signal = new AbortController().signal

    await expect(
      locateReferenceDong(
        '수원시 장안구',
        '가상동',
        '9999999999',
        '가상동',
        'test-key',
        signal,
        '경기도',
      ),
    ).resolves.toMatchObject({ region: otherRegion })
    expect(mocks.keywordSearch).toHaveBeenCalledWith(
      '경기도 수원시 장안구 가상동 주민센터',
      expect.any(Function),
      { size: 3 },
    )

    mocks.lookup.mockResolvedValue({ ...otherRegion, region_1depth_name: '서울특별시' })
    await expect(
      locateReferenceDong(
        '수원시 장안구',
        '가상동',
        '9999999999',
        '가상동',
        'test-key',
        signal,
        '경기도',
      ),
    ).rejects.toMatchObject({ code: 'MISMATCH' })
  })

  it('주민센터 후보가 다른 행정동에 있으면 다음 실제 후보를 역조회한다', async () => {
    const other = { place_name: '인근 시설', x: '126.897', y: '37.492' }
    mocks.keywordSearch.mockImplementation((_query, callback) => callback([other, center], 'OK'))
    mocks.lookup.mockResolvedValueOnce({ ...region, code: '1156068000' }).mockResolvedValue(region)
    await expect(invoke()).resolves.toMatchObject({ region, center: [37.493, 126.898] })
    expect(mocks.lookup).toHaveBeenCalledTimes(2)
  })

  it('원천명으로 못 찾으면 공식명을 검색하되 같은 이름은 중복 요청하지 않는다', async () => {
    mocks.keywordSearch.mockImplementation((query, callback) => {
      callback(
        query.includes('대림제1동') ? [center] : [],
        query.includes('대림제1동') ? 'OK' : 'ZERO_RESULT',
      )
    })
    await expect(invoke()).resolves.toMatchObject({ region, center: [37.493, 126.898] })
    expect(mocks.keywordSearch.mock.calls.map(([query]) => query)).toEqual([
      '서울특별시 영등포구 대림1동 주민센터',
      '서울특별시 영등포구 대림제1동 주민센터',
    ])
  })

  it('결과 없음, 오류, 잘못된 좌표를 구분하고 임의의 좌표를 반환하지 않는다', async () => {
    mocks.keywordSearch.mockImplementation((_query, callback) => callback([], 'ZERO_RESULT'))
    await expect(invoke()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    mocks.keywordSearch.mockImplementation((_query, callback) => callback([], 'ERROR'))
    await expect(invoke()).rejects.toMatchObject({ code: 'SERVICE_ERROR' })
    mocks.keywordSearch.mockImplementation((_query, callback) =>
      callback([{ ...center, x: 'NaN' }], 'OK'),
    )
    await expect(invoke()).rejects.toMatchObject({ code: 'SERVICE_ERROR' })
    expect(mocks.lookup).not.toHaveBeenCalled()
  })

  it('역조회 서비스 장애를 불일치로 숨기지 않는다', async () => {
    mocks.lookup.mockRejectedValue(new Error('network'))
    await expect(invoke()).rejects.toMatchObject({ code: 'SERVICE_ERROR' })
  })

  it('요청 취소와 위치 조회 제한 시간을 구분하고 늦은 SDK 콜백을 무시한다', async () => {
    mocks.keywordSearch.mockImplementation(() => {})
    const controller = new AbortController()
    const cancelled = expect(invoke(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    await Promise.resolve()
    controller.abort()
    await cancelled

    vi.useFakeTimers()
    const timeout = expect(invoke()).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(20_000)
    await timeout
  })

  it('SDK 로딩이 지연 중이어도 선택 변경 시 즉시 취소한다', async () => {
    mocks.load.mockReturnValue(new Promise(() => {}))
    const controller = new AbortController()
    const result = expect(invoke(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await result
    expect(mocks.keywordSearch).not.toHaveBeenCalled()
  })
})

describe('자치구의 실제 위치 조회', () => {
  it('역조회로 구가 일치하는 실제 장소를 반환하고 임의 동 이름이나 코드를 만들지 않는다', async () => {
    const result = await locateReferenceDistrict(
      '영등포구',
      'test-key',
      new AbortController().signal,
    )
    expect(result).toEqual({ region, center: [37.493, 126.898], placeName: '대림1동 주민센터' })
    expect(mocks.keywordSearch).toHaveBeenCalledWith(
      '서울특별시 영등포구청',
      expect.any(Function),
      { size: 3 },
    )
  })

  it('다른 구의 좌표는 선택한 구를 표시하는 데 사용하지 않는다', async () => {
    mocks.lookup.mockResolvedValue({ ...region, region_2depth_name: '구로구' })
    await expect(
      locateReferenceDistrict('영등포구', 'test-key', new AbortController().signal),
    ).rejects.toMatchObject({ code: 'MISMATCH' })
  })

  it('서울 외 지역은 선택한 시도와 구에 속하는 후보만 허용한다', async () => {
    const otherRegion: KakaoRegionResult = {
      ...region,
      code: '9999999999',
      address_name: '경기도 수원시 장안구 가상동',
      region_1depth_name: '경기도',
      region_2depth_name: '수원시 장안구',
      region_3depth_name: '가상동',
    }
    mocks.lookup.mockResolvedValue(otherRegion)
    const signal = new AbortController().signal

    await expect(
      locateReferenceDistrict('수원시 장안구', 'test-key', signal, '경기도'),
    ).resolves.toMatchObject({ region: otherRegion })
    expect(mocks.keywordSearch).toHaveBeenCalledWith(
      '경기도 수원시 장안구청',
      expect.any(Function),
      { size: 3 },
    )
    mocks.lookup.mockResolvedValue({ ...otherRegion, region_2depth_name: '수원시 권선구' })
    await expect(
      locateReferenceDistrict('수원시 장안구', 'test-key', signal, '경기도'),
    ).rejects.toMatchObject({ code: 'MISMATCH' })
  })

  it('자치구 변경으로 취소하면 늦은 검색 응답을 사용하지 않는다', async () => {
    let callback: ((items: (typeof center)[], status: string) => void) | undefined
    mocks.keywordSearch.mockImplementation((_query, next) => {
      callback = next
    })
    const controller = new AbortController()
    const result = expect(
      locateReferenceDistrict('영등포구', 'test-key', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(callback).toBeDefined())
    controller.abort()
    callback?.([center], 'OK')
    await result
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
})
