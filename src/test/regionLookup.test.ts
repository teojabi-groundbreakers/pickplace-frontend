import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KakaoMapsApi, KakaoRegionResult } from '../lib/kakaoMaps'
import { findSupportedRegion, lookupAdministrativeRegion } from '../lib/regionLookup'

const sdk = vi.hoisted(() => ({ load: vi.fn(), query: vi.fn() }))
vi.mock('../lib/kakaoMaps', () => ({ loadKakaoMaps: sdk.load }))
const administrative: KakaoRegionResult = {
  region_type: 'H',
  code: '1120069000',
  address_name: '서울특별시 성동구 성수2가제1동',
  region_1depth_name: '서울특별시',
  region_2depth_name: '성동구',
  region_3depth_name: '성수2가제1동',
}
beforeEach(() => {
  sdk.query.mockReset()
  sdk.load.mockReset().mockResolvedValue({
    services: {
      Geocoder: class {
        coord2RegionCode = sdk.query
      },
    },
  } as unknown as KakaoMapsApi)
})
afterEach(() => vi.useRealTimers())
const lookup = (signal = new AbortController().signal) =>
  lookupAdministrativeRegion([37.54, 127.05], 'test-key', signal)

describe('실제 좌표의 행정동 조회', () => {
  it('경도·위도 순서로 요청하고 법정동 대신 행정동을 반환한다', async () => {
    sdk.query.mockImplementation((lng, lat, callback) => {
      expect([lng, lat]).toEqual([127.05, 37.54])
      callback([{ ...administrative, region_type: 'B' }, administrative], 'OK')
    })
    await expect(lookup()).resolves.toEqual(administrative)
  })

  it('행정동이 없으면 법정동을 대체 결과로 사용하지 않는다', async () => {
    sdk.query.mockImplementation((_lng, _lat, callback) =>
      callback([{ ...administrative, region_type: 'B' }], 'OK'),
    )
    await expect(lookup()).resolves.toBeNull()
    sdk.query.mockImplementation((_lng, _lat, callback) => callback([], 'ZERO_RESULT'))
    await expect(lookup()).resolves.toBeNull()
  })

  it('미설정·오류·잘못된 응답을 명시적으로 처리한다', async () => {
    await expect(
      lookupAdministrativeRegion([37, 127], '', new AbortController().signal),
    ).rejects.toThrow('설정')
    expect(sdk.load).not.toHaveBeenCalled()
    sdk.query.mockImplementation((_lng, _lat, callback) => callback([], 'ERROR'))
    await expect(lookup()).rejects.toThrow('조회하지 못했어요')
    sdk.query.mockImplementation((_lng, _lat, callback) =>
      callback([{ ...administrative, code: 'invalid' }], 'OK'),
    )
    await expect(lookup()).rejects.toThrow('응답')
  })

  it('SDK 연결 실패나 services 누락을 조회 실패로 반환한다', async () => {
    sdk.load.mockRejectedValueOnce(new Error('SDK error'))
    await expect(lookup()).rejects.toThrow('연결에 실패')
    sdk.load.mockResolvedValueOnce({})
    await expect(lookup()).rejects.toThrow('서비스')
  })

  it('취소한 요청은 늦게 도착한 응답으로 완료되지 않는다', async () => {
    const controller = new AbortController()
    const result = lookup(controller.signal)
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    const callback = sdk.query.mock.calls[0][2]
    controller.abort()
    callback([administrative], 'OK')
    await rejected
  })

  it('무응답 조회를 제한 시간 안에 종료한다', async () => {
    vi.useFakeTimers()
    const failed = expect(lookup()).rejects.toThrow('지연')
    await vi.advanceTimersByTimeAsync(10_000)
    await failed
  })

  it('데모 코드 길이를 보정해 유일하게 일치하는 예시 지역을 찾는다', () => {
    const region = {
      code: '11200690',
      name: '성수2가1동',
      fullName: '성동구 성수2가1동',
      center: [37.54, 127.05] as [number, number],
    }
    expect(findSupportedRegion([region], administrative.code)).toEqual(region)
    expect(findSupportedRegion([region], '1120065000')).toBeNull()
    expect(
      findSupportedRegion([region, { ...region, code: administrative.code }], administrative.code),
    ).toBeNull()
  })
})
