import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../lib/config'
import { getGroups, getLocalities, getProvinces } from '../lib/nationwideRegions'

const province = {
  regionCode: '3600000000',
  regionName: '세종특별자치시',
  selectionLevel: 'PROVINCE',
  parentCode: null,
  autoSelect: false,
}
const group = {
  regionCode: '3611000000',
  regionName: '세종특별자치시',
  selectionLevel: 'GROUP',
  parentCode: province.regionCode,
  autoSelect: true,
}
const locality = {
  regionCode: '3611025000',
  regionName: '조치원읍',
  selectionLevel: 'LOCALITY',
  parentCode: group.regionCode,
  autoSelect: false,
}
const metadata = {
  requestId: 'region-test-request',
  codeSystem: 'MOIS_H10',
  sourceReferenceOn: '2026-10-30',
  sourceFileVersion: '20261026',
}
const response = (items: unknown[], meta: Record<string, unknown> = metadata) =>
  new Response(JSON.stringify({ data: { items }, meta }))

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('전국 H10 기준정보 API 준비', () => {
  it('공개 선택 버전 없이 시·도와 세종 그룹·읍면동을 조회한다', async () => {
    fetchMock
      .mockResolvedValueOnce(response([province]))
      .mockResolvedValueOnce(response([group]))
      .mockResolvedValueOnce(response([locality]))

    expect(await getProvinces()).toEqual({ items: [province], ...metadata })
    expect(await getGroups(province.regionCode)).toEqual({ items: [group], ...metadata })
    expect(await getLocalities(group.regionCode)).toEqual({
      items: [locality],
      ...metadata,
    })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${config.apiBaseUrl}/regions/provinces`,
      `${config.apiBaseUrl}/regions/groups?provinceCode=3600000000`,
      `${config.apiBaseUrl}/regions/localities?groupCode=3611000000`,
    ])
  })

  it('서버 정렬을 유지하며 정상 빈 목록과 null 기준일을 허용한다', async () => {
    const second = { ...group, regionCode: '3612000000', regionName: '가상의 그룹' }
    fetchMock
      .mockResolvedValueOnce(response([group, second]))
      .mockResolvedValueOnce(response([], { ...metadata, sourceReferenceOn: null }))

    expect((await getGroups(province.regionCode)).items).toEqual([group, second])
    expect(await getLocalities(group.regionCode)).toEqual({
      items: [],
      ...metadata,
      sourceReferenceOn: null,
    })
  })

  it.each(['', '360000000', ' 3600000000', '３６００００００００'])(
    '잘못된 H10 입력은 요청 전 거부한다',
    async (code) => {
      await expect(getGroups(code)).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_REGION_CODE',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each([
    { ...group, regionCode: 3611000000 },
    { ...group, parentCode: '1100000000' },
    { ...group, selectionLevel: 'LOCALITY' },
    { ...group, autoSelect: 'true' },
    { ...group, regionName: '' },
  ])('잘못된 항목 또는 부모 관계를 요청 ID와 함께 거부한다', async (item) => {
    fetchMock.mockResolvedValueOnce(response([item]))
    await expect(getGroups(province.regionCode)).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE',
      requestId: metadata.requestId,
    })
  })

  it('중복 코드와 그룹 이외 계층의 자동 선택 표시를 거부한다', async () => {
    fetchMock
      .mockResolvedValueOnce(response([group, group]))
      .mockResolvedValueOnce(response([{ ...province, autoSelect: true }]))
    await expect(getGroups(province.regionCode)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    await expect(getProvinces()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('응답에 이전 선택 버전 필드가 있어도 사용하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(response([group], { ...metadata, regionVersion: 'previous' }))
    await expect(getGroups(province.regionCode)).resolves.toEqual({
      items: [group],
      ...metadata,
    })
  })

  it('메타데이터의 코드 체계·기준일·필수 필드를 검증한다', async () => {
    fetchMock
      .mockResolvedValueOnce(response([province], { ...metadata, codeSystem: 'seoul-adstrd' }))
      .mockResolvedValueOnce(response([province], { ...metadata, sourceReferenceOn: '2026-02-30' }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { items: [province] },
            meta: { ...metadata, sourceReferenceOn: undefined },
          }),
        ),
      )
    for (let index = 0; index < 3; index++) {
      await expect(getProvinces()).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
        requestId: metadata.requestId,
      })
    }
  })

  it('성공 응답의 JSON 또는 메타데이터 오류 시 헤더 요청 ID를 보존한다', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('{invalid json', { headers: { 'X-Request-Id': 'bad-json-id' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { items: [province] }, meta: {} }), {
          headers: { 'X-Request-Id': 'bad-meta-id' },
        }),
      )

    await expect(getProvinces()).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE',
      requestId: 'bad-json-id',
    })
    await expect(getProvinces()).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE',
      requestId: 'bad-meta-id',
    })
  })

  it('일반 충돌과 서비스 준비 중을 코드·요청 ID와 함께 전파한다', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'REGION_VERSION_CONFLICT' },
            meta: { requestId: 'conflict-request' },
          }),
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'REFERENCE_DATA_NOT_READY' } }), {
          status: 503,
          headers: { 'X-Request-Id': 'not-ready-request' },
        }),
      )

    await expect(getGroups(province.regionCode)).rejects.toMatchObject({
      status: 409,
      code: 'REGION_VERSION_CONFLICT',
      requestId: 'conflict-request',
    })
    await expect(getProvinces()).rejects.toMatchObject({
      status: 503,
      code: 'REFERENCE_DATA_NOT_READY',
      requestId: 'not-ready-request',
    })
  })

  it('호출자가 취소한 요청을 네트워크 오류로 바꾸지 않는다', async () => {
    const controller = new AbortController()
    const error = new DOMException('cancelled', 'AbortError')
    controller.abort(error)
    fetchMock.mockRejectedValueOnce(error)
    await expect(getProvinces(controller.signal)).rejects.toBe(error)
  })
})
