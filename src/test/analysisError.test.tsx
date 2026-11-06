import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultRequest } from '../data/demo'
import { analyze } from '../lib/api'
import { config } from '../lib/config'
import { useAnalysis } from '../lib/useAnalysis'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  config.demoMode = false
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  config.demoMode = true
  vi.unstubAllGlobals()
})

describe('분석 API의 오류 응답', () => {
  it('BE 오류 래퍼의 코드와 본문 요청 ID를 보존한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'NOT_FOUND', message: 'internal detail', details: [] },
          meta: { requestId: 'request-123' },
        }),
        { status: 404, headers: { 'X-Request-Id': 'header-id' } },
      ),
    )

    await expect(analyze(defaultRequest)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      requestId: 'request-123',
      message: '서버가 요청을 처리하지 못했습니다. (404)',
    })
  })

  it('본문 ID가 없는 오류의 요청 ID를 헤더에서 읽는다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('gateway error', {
        status: 503,
        headers: { 'X-Request-Id': 'header-123' },
      }),
    )

    await expect(analyze(defaultRequest)).rejects.toMatchObject({
      status: 503,
      code: 'REQUEST_FAILED',
      requestId: 'header-123',
    })
  })

  it('일반 분석 오류의 안내에 요청 ID를 표시한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'NOT_FOUND', message: 'internal detail', details: [] },
          meta: { requestId: 'not-found-request' },
        }),
        { status: 404 },
      ),
    )

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.run(defaultRequest)
    })

    expect(result.current.state).toMatchObject({
      status: 'error',
      message: '서버가 요청을 처리하지 못했습니다. (404) (요청 ID: not-found-request)',
    })
  })

  it('래퍼의 데이터 부족을 빈 결과로 구분하고 요청 ID를 표시한다', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'INSUFFICIENT_DATA', message: 'internal', details: [] },
          meta: { requestId: 'empty-request' },
        }),
        { status: 422 },
      ),
    )

    const { result } = renderHook(() => useAnalysis())
    await act(async () => {
      await result.current.run(defaultRequest)
    })

    expect(result.current.state).toMatchObject({
      status: 'empty',
      message: '분석할 데이터가 충분하지 않습니다. (요청 ID: empty-request)',
    })
  })
})
