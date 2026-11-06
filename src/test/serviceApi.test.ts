import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDatabaseReadiness, getDistricts, getServiceHealth } from '../lib/serviceApi'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mockPendingBody() {
  const reading = vi.fn()

  fetchMock.mockImplementationOnce(async (_url: string, { signal }: RequestInit) => {
    const response = new Response()

    vi.spyOn(response, 'json').mockImplementation(
      () =>
        new Promise((_, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Body reading aborted', 'AbortError')),
            { once: true },
          )
          reading()
        }),
    )

    return response
  })

  return reading
}

describe('서비스 API 계약', () => {
  it.each([
    { path: '/api/health', load: getServiceHealth },
    { path: '/api/health/ready', load: getDatabaseReadiness },
  ])('$path 응답의 상태와 요청 ID를 읽는다', async ({ path, load }) => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ data: { status: 'UP' }, meta: { requestId: 'health-1' } }),
    )

    await expect(load()).resolves.toEqual({ data: { status: 'UP' }, requestId: 'health-1' })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      path,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('부분 적재 목록의 코드 문자열과 서버 배열 순서를 보존한다', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        data: {
          items: [
            { districtCode: '11140', districtName: '중구' },
            { districtCode: '11110', districtName: '종로구' },
          ],
        },
        meta: { requestId: 'districts-1' },
      }),
    )

    await expect(getDistricts()).resolves.toEqual({
      data: {
        items: [
          { code: '11140', name: '중구' },
          { code: '11110', name: '종로구' },
        ],
      },
      requestId: 'districts-1',
    })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      '/api/districts',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('기준정보 미적재의 빈 목록을 정상 응답으로 반환한다', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ data: { items: [] }, meta: { requestId: 'empty-1' } }),
    )

    await expect(getDistricts()).resolves.toEqual({
      data: { items: [] },
      requestId: 'empty-1',
    })
  })

  it.each([
    { data: { items: [] } },
    { data: { items: [] }, meta: { requestId: '' } },
    { data: { items: null }, meta: { requestId: 'bad-items' } },
    {
      data: { items: [{ districtCode: 11110, districtName: '종로구' }] },
      meta: { requestId: 'bad-code' },
    },
    {
      data: { items: [{ districtCode: '111100', districtName: '종로구' }] },
      meta: { requestId: 'bad-length' },
    },
    {
      data: { items: [{ districtCode: '11110', districtName: ' ' }] },
      meta: { requestId: 'bad-name' },
    },
  ])('계약과 다른 자치구 응답을 거부한다: %j', async (body) => {
    fetchMock.mockResolvedValueOnce(Response.json(body))

    await expect(getDistricts()).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' })
  })

  it('200 응답이어도 정상 상태 값이 없으면 준비 완료로 취급하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ data: { status: 'DOWN' }, meta: { requestId: 'invalid-ready' } }),
    )

    await expect(getDatabaseReadiness()).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE',
      requestId: 'invalid-ready',
    })
  })

  it.each([
    { status: 503, code: 'DATA_SERVICE_UNAVAILABLE' },
    { status: 404, code: 'NOT_FOUND' },
  ])('$status 오류를 빈 목록으로 바꾸지 않는다', async ({ status, code }) => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          error: { code, message: '서버가 작성한 상세 문구', details: [] },
          meta: { requestId: 'body-id' },
        },
        { status, headers: { 'X-Request-Id': 'header-id' } },
      ),
    )

    await expect(getDistricts()).rejects.toMatchObject({
      status,
      code,
      message: `서버가 요청을 처리하지 못했습니다. (${status})`,
      requestId: 'body-id',
    })
  })

  it('프록시 오류 본문이 JSON이 아니어도 HTTP 상태와 요청 ID를 보존한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'X-Request-Id': 'gateway-id' },
      }),
    )

    await expect(getDistricts()).rejects.toMatchObject({
      status: 502,
      code: 'REQUEST_FAILED',
      requestId: 'gateway-id',
    })
  })

  it('서버 응답 없이 연결에 실패하면 네트워크 오류로 처리한다', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(getDistricts()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('응답 본문을 받던 중 시간 제한에 도달하면 형식 오류 대신 타임아웃을 반환한다', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(timeout.signal)
    const reading = mockPendingBody()

    const check = expect(getDistricts()).rejects.toMatchObject({ status: 0, code: 'TIMEOUT' })
    await vi.waitFor(() => expect(reading).toHaveBeenCalled())
    timeout.abort(new DOMException('Timed out', 'TimeoutError'))

    await check
  })

  it('응답 본문을 받던 중 호출자가 취소하면 취소를 그대로 반환한다', async () => {
    const controller = new AbortController()
    const reading = mockPendingBody()

    const check = expect(getDistricts(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    await vi.waitFor(() => expect(reading).toHaveBeenCalled())
    controller.abort()

    await check
  })
})
