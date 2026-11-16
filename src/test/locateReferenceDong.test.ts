import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  locateNationwideReferenceDong,
  locateNationwideReferenceGroup,
  locateReferenceDistrict,
  locateReferenceDong,
} from '../lib/locateReferenceDong'
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

describe('전국 H10 지역의 실제 위치 조회', () => {
  const signal = () => new AbortController().signal
  const suwon: KakaoRegionResult = {
    ...region,
    code: '4111156000',
    address_name: '경기도 수원시 장안구 영화동',
    region_1depth_name: '경기도',
    region_2depth_name: '수원시',
    region_3depth_name: '영화동',
  }

  it('복합 그룹 표시명과 카카오 지역명이 달라도 선택 H10과 시도가 일치하면 실제 위치를 반환한다', async () => {
    mocks.lookup.mockResolvedValue(suwon)
    await expect(
      locateNationwideReferenceDong(
        '경기도',
        '수원시 장안구',
        '영화동',
        suwon.code,
        'test-key',
        signal(),
      ),
    ).resolves.toEqual({ region: suwon, center: [37.493, 126.898], placeName: center.place_name })
    expect(mocks.keywordSearch).toHaveBeenCalledWith(
      '경기도 수원시 장안구 영화동 주민센터',
      expect.any(Function),
      { size: 3 },
    )
  })

  it('세종의 시도와 그룹 표시명이 같으면 중복 없이 검색하고 H10으로 확인한다', async () => {
    const sejong: KakaoRegionResult = {
      ...region,
      code: '3611025000',
      address_name: '세종특별자치시 조치원읍',
      region_1depth_name: '세종특별자치시',
      region_2depth_name: '',
      region_3depth_name: '조치원읍',
    }
    mocks.lookup.mockResolvedValue(sejong)
    await expect(
      locateNationwideReferenceDong(
        '세종특별자치시',
        '세종특별자치시',
        '조치원읍',
        sejong.code,
        'test-key',
        signal(),
      ),
    ).resolves.toMatchObject({ region: sejong })
    expect(mocks.keywordSearch).toHaveBeenCalledWith(
      '세종특별자치시 조치원읍 주민센터',
      expect.any(Function),
      { size: 3 },
    )
  })

  it('동명이 같아도 H10 또는 시도가 다르면 위치를 거부한다', async () => {
    mocks.lookup.mockResolvedValue({ ...suwon, code: '4111157000' })
    const locate = () =>
      locateNationwideReferenceDong(
        '경기도',
        '수원시 장안구',
        '영화동',
        suwon.code,
        'test-key',
        signal(),
      )
    await expect(locate()).rejects.toMatchObject({ code: 'MISMATCH' })
    mocks.lookup.mockResolvedValue({ ...suwon, region_1depth_name: '서울특별시' })
    await expect(locate()).rejects.toMatchObject({ code: 'MISMATCH' })
  })

  it('숫자형 H10 또는 숫자형 역조회 코드는 허용하지 않는다', async () => {
    await expect(
      locateNationwideReferenceDong(
        '경기도',
        '수원시 장안구',
        '영화동',
        4111156000 as unknown as string,
        'test-key',
        signal(),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(mocks.keywordSearch).not.toHaveBeenCalled()
    mocks.lookup.mockResolvedValue({ ...suwon, code: 4111156000 })
    await expect(
      locateNationwideReferenceDong(
        '경기도',
        '수원시 장안구',
        '영화동',
        suwon.code,
        'test-key',
        signal(),
      ),
    ).rejects.toMatchObject({ code: 'MISMATCH' })
  })

  it('선택 변경 시 위치 조회를 취소하고 늦은 검색 결과를 사용하지 않는다', async () => {
    let callback: ((items: (typeof center)[], status: string) => void) | undefined
    mocks.keywordSearch.mockImplementation((_query, next) => {
      callback = next
    })
    const controller = new AbortController()
    const result = expect(
      locateNationwideReferenceDong(
        '경기도',
        '수원시 장안구',
        '영화동',
        suwon.code,
        'test-key',
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(callback).toBeDefined())
    controller.abort()
    callback?.([center], 'OK')
    await result
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
})

describe('전국 그룹의 실제 위치 조회', () => {
  const province = '경기도'
  const group = '수원시 장안구'
  const localityCodes = ['4111156000', '4111157000']
  const suwon: KakaoRegionResult = {
    ...region,
    code: localityCodes[0],
    address_name: '경기도 수원시 장안구 영화동',
    region_1depth_name: province,
    region_2depth_name: '수원시',
    region_3depth_name: '영화동',
  }

  it('복합 그룹 이름을 검색하고 소속 읍면동 H10이 일치하는 실제 좌표를 사용한다', async () => {
    mocks.lookup.mockResolvedValue(suwon)
    await expect(
      locateNationwideReferenceGroup(
        province,
        group,
        localityCodes,
        'test-key',
        new AbortController().signal,
      ),
    ).resolves.toEqual({ region: suwon, center: [37.493, 126.898], placeName: center.place_name })
    expect(mocks.keywordSearch).toHaveBeenCalledWith(
      '경기도 수원시 장안구청',
      expect.any(Function),
      { size: 3 },
    )
  })

  it('목록 밖 H10이나 다른 시도의 장소는 그룹 위치로 사용하지 않는다', async () => {
    const locate = () =>
      locateNationwideReferenceGroup(
        province,
        group,
        localityCodes,
        'test-key',
        new AbortController().signal,
      )
    mocks.lookup.mockResolvedValue({ ...suwon, code: '4111353000' })
    await expect(locate()).rejects.toMatchObject({ code: 'MISMATCH' })
    mocks.lookup.mockResolvedValue({ ...suwon, region_1depth_name: '서울특별시' })
    await expect(locate()).rejects.toMatchObject({ code: 'MISMATCH' })
  })

  it('소속 목록이 비었거나 숫자형·잘못된 형식이 섞이면 위치를 조회하지 않는다', async () => {
    for (const codes of [[], ['4111156000', 4111157000], ['4111156000', '41111570']]) {
      await expect(
        locateNationwideReferenceGroup(
          province,
          group,
          codes as string[],
          'test-key',
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    expect(mocks.keywordSearch).not.toHaveBeenCalled()
  })

  it('역조회에서 숫자형 코드를 반환해도 소속 읍면동으로 취급하지 않는다', async () => {
    mocks.lookup.mockResolvedValue({ ...suwon, code: 4111156000 })
    await expect(
      locateNationwideReferenceGroup(
        province,
        group,
        localityCodes,
        'test-key',
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'MISMATCH' })
  })

  it('시도와 그룹 표시명이 같은 세종은 그룹명을 중복하지 않는다', async () => {
    const sejong = {
      ...suwon,
      code: '3611025000',
      address_name: '세종특별자치시 조치원읍',
      region_1depth_name: '세종특별자치시',
      region_2depth_name: '',
      region_3depth_name: '조치원읍',
    }
    mocks.lookup.mockResolvedValue(sejong)
    await expect(
      locateNationwideReferenceGroup(
        '세종특별자치시',
        '세종특별자치시',
        [sejong.code],
        'test-key',
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ region: sejong })
    expect(mocks.keywordSearch).toHaveBeenCalledWith('세종특별자치시청', expect.any(Function), {
      size: 3,
    })
  })

  it('그룹 변경 시 진행 중인 검색을 취소한다', async () => {
    let callback: ((items: (typeof center)[], status: string) => void) | undefined
    mocks.keywordSearch.mockImplementation((_query, next) => {
      callback = next
    })
    const controller = new AbortController()
    const result = expect(
      locateNationwideReferenceGroup(province, group, localityCodes, 'test-key', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(callback).toBeDefined())
    controller.abort()
    callback?.([center], 'OK')
    await result
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
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

  it('역조회가 숫자형 코드를 반환하면 일치하는 구여도 결과를 거부한다', async () => {
    mocks.lookup.mockResolvedValue({ ...region, code: 1156070000 })
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
