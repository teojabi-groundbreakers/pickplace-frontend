import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAdministrativeDongs, getBusinessTypes, getDistricts } from '../lib/backendReference'
import { config } from '../lib/config'
import { ApiError } from '../lib/api'

const fetchMock = vi.fn()
const envelope = (items: unknown[]) => ({ data: { items }, meta: { requestId: 'test-request' } })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('백엔드 기준정보 목록', () => {
  it('공통 래퍼의 목록과 요청 ID를 읽고 순서와 원본 코드를 보존한다', async () => {
    const districts = [
      { districtCode: '11110', districtName: '종로구' },
      { districtCode: '11140', districtName: '중구' },
    ]
    const dongs = [
      {
        dongCode: '11110515',
        dongName: '청운효자동',
        districtCode: '11110',
        officialCodeStatus: 'LEGACY',
        regionVersion: 'version-1',
      },
    ]
    const businessTypes = [
      { businessTypeCode: 'CS100010', businessTypeName: '커피·음료', supported: true },
    ]
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope(districts))))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope(dongs))))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope(businessTypes))))

    expect(await getDistricts()).toEqual({ items: districts, requestId: 'test-request' })
    expect(await getAdministrativeDongs('11110')).toEqual({
      items: dongs,
      requestId: 'test-request',
    })
    expect(await getBusinessTypes()).toEqual({ items: businessTypes, requestId: 'test-request' })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${config.apiBaseUrl}/districts`,
      `${config.apiBaseUrl}/districts/11110/administrative-dongs`,
      `${config.apiBaseUrl}/business-types`,
    ])
  })

  it('정상 빈 목록을 장애로 처리하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(envelope([]))))
    expect(await getDistricts()).toEqual({ items: [], requestId: 'test-request' })
  })

  it('서버 오류 코드와 요청 ID를 보존한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'DATA_SERVICE_UNAVAILABLE', message: 'unavailable', details: [] },
          meta: { requestId: 'failed-request' },
        }),
        { status: 503 },
      ),
    )
    await expect(getBusinessTypes()).rejects.toMatchObject({
      status: 503,
      code: 'DATA_SERVICE_UNAVAILABLE',
      requestId: 'failed-request',
    })
  })

  it('래퍼가 없거나 코드와 소속이 올바르지 않은 결과를 거부한다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
    await expect(getDistricts()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope([{ districtCode: 11110, districtName: '종로구' }]))),
    )
    await expect(getDistricts()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          envelope([
            {
              dongCode: '11140515',
              dongName: '동',
              districtCode: '11140',
              officialCodeStatus: 'CURRENT',
              regionVersion: 'v1',
            },
          ]),
        ),
      ),
    )
    await expect(getAdministrativeDongs('11110')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      requestId: 'test-request',
    })
  })

  it('통신 실패, 시간 초과와 호출자 취소를 구별한다', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network'))
    await expect(getDistricts()).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    await expect(getDistricts()).rejects.toMatchObject({ code: 'TIMEOUT' })
    const controller = new AbortController()
    const error = new DOMException('cancelled', 'AbortError')
    controller.abort(error)
    fetchMock.mockRejectedValueOnce(error)
    await expect(getDistricts(controller.signal)).rejects.toBe(error)
  })

  it('오류는 공통 ApiError를 사용한다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 503 }))
    await expect(getDistricts()).rejects.toBeInstanceOf(ApiError)
  })

  it('행정동 코드와 업종 지원 여부의 잘못된 형식을 거부한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          envelope([
            {
              dongCode: '1111051500',
              dongName: '청운효자동',
              districtCode: '11110',
              officialCodeStatus: 'CURRENT',
              regionVersion: 'v1',
            },
          ]),
        ),
      ),
    )
    await expect(getAdministrativeDongs('11110')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          envelope([
            { businessTypeCode: 'CS100010', businessTypeName: '커피·음료', supported: 'Y' },
          ]),
        ),
      ),
    )
    await expect(getBusinessTypes()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
