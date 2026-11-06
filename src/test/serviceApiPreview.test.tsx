import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../lib/config'
import { Guide } from '../pages/Guide'

vi.mock('../lib/config', () => ({
  config: {
    apiBaseUrl: '/api',
    demoMode: true,
    serviceApiPreview: false,
    requestTimeout: 30_000,
  },
}))

const fetchMock = vi.fn<typeof fetch>()
const panelName = '서비스 API 연결 확인'

function guide() {
  return (
    <MemoryRouter>
      <Guide />
    </MemoryRouter>
  )
}

function requestPath(input: RequestInfo | URL) {
  return new URL(input instanceof Request ? input.url : input, window.location.href).pathname
}

function status(title: string) {
  return within(screen.getByRole('region', { name: title })).getByRole('status')
}

function success(data: unknown) {
  return Response.json({ data, meta: { requestId: 'preview-test' } })
}

function pendingResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })

  return { promise, resolve }
}

beforeEach(() => {
  config.serviceApiPreview = false
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('서비스 API 확인', () => {
  it('옵션으로 패널을 표시하되 사용자 요청 전에는 조회하지 않는다', () => {
    const { rerender } = render(guide())
    expect(screen.queryByRole('region', { name: panelName })).not.toBeInTheDocument()

    config.serviceApiPreview = true
    rerender(guide())

    const panel = screen.getByRole('region', { name: panelName })
    expect(within(panel).getByRole('button', { name: '서비스 연결 확인' })).toBeEnabled()
    expect(screen.getByRole('link', { name: '정상 분석' })).toHaveAttribute(
      'href',
      '/?scenario=success',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('서버가 살아 있어도 DB 오류와 목록 조회를 구분하고 재시도 뒤 빈 목록을 표시한다', async () => {
    config.serviceApiPreview = true
    const user = userEvent.setup()
    const districtsResponse = pendingResponse()

    fetchMock.mockImplementation(async (input) => {
      switch (requestPath(input)) {
        case '/api/health':
          return success({ status: 'UP' })
        case '/api/health/ready':
          return Response.json(
            {
              error: { code: 'DATA_SERVICE_UNAVAILABLE', message: 'Database unavailable' },
              meta: { requestId: 'db-not-ready' },
            },
            { status: 503 },
          )
        case '/api/districts':
          return districtsResponse.promise
        default:
          throw new Error('Unexpected request')
      }
    })

    render(guide())
    await user.click(screen.getByRole('button', { name: '서비스 연결 확인' }))

    expect(fetchMock).toHaveBeenCalledTimes(3)
    await waitFor(() => expect(status('서비스 서버')).toHaveTextContent('서버가 실행 중이에요.'))
    await waitFor(() => expect(status('데이터베이스')).toHaveTextContent(/503.*db-not-ready/))
    expect(status('서울 자치구 목록')).toHaveTextContent('확인 중이에요.')

    districtsResponse.resolve(
      success({ items: [{ districtCode: '11110', districtName: '종로구' }] }),
    )
    await user.click(await screen.findByText('자치구와 코드 보기'))
    expect(screen.getByRole('listitem')).toHaveTextContent('종로구 · 11110')

    fetchMock.mockImplementation(async (input) =>
      requestPath(input) === '/api/districts' ? success({ items: [] }) : success({ status: 'UP' }),
    )
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(fetchMock).toHaveBeenCalledTimes(6)
    await waitFor(() =>
      expect(status('서울 자치구 목록')).toHaveTextContent(
        '조회는 성공했지만 표시할 자치구가 없어요.',
      ),
    )
    expect(status('데이터베이스')).toHaveTextContent('데이터베이스가 준비됐어요.')
    expect(screen.queryByText('자치구와 코드 보기')).not.toBeInTheDocument()
  })

  it('없는 API, 연결 실패, 응답 시간 초과를 각각 안내한다', async () => {
    config.serviceApiPreview = true
    const user = userEvent.setup()

    fetchMock.mockImplementation(async (input) => {
      switch (requestPath(input)) {
        case '/api/health':
          return new Response(null, { status: 404, headers: { 'X-Request-Id': 'route-missing' } })
        case '/api/health/ready':
          throw new TypeError('Failed to fetch')
        case '/api/districts':
          throw new DOMException('Timed out', 'TimeoutError')
        default:
          throw new Error('Unexpected request')
      }
    })

    render(guide())
    await user.click(screen.getByRole('button', { name: '서비스 연결 확인' }))

    await waitFor(() => {
      expect(status('서비스 서버')).toHaveTextContent(/404.*route-missing/)
      expect(status('데이터베이스')).toHaveTextContent('네트워크 연결을 확인해 주세요.')
      expect(status('서울 자치구 목록')).toHaveTextContent('응답 시간이 초과되었습니다.')
    })
    expect(screen.queryByText('조회는 성공했지만 표시할 자치구가 없어요.')).not.toBeInTheDocument()
  })

  it('다시 확인하면 이전 조회를 취소하고 가이드를 떠나면 진행 중인 요청을 취소한다', async () => {
    config.serviceApiPreview = true
    const user = userEvent.setup()
    const previousResponse = pendingResponse()
    const previousSignals: AbortSignal[] = []

    fetchMock.mockImplementation(async (_, options) => {
      if (options?.signal) previousSignals.push(options.signal)
      return previousResponse.promise
    })

    const { unmount } = render(guide())
    await user.click(screen.getByRole('button', { name: '서비스 연결 확인' }))

    fetchMock.mockImplementation(async (input) =>
      requestPath(input) === '/api/districts' ? success({ items: [] }) : success({ status: 'UP' }),
    )
    await user.click(screen.getByRole('button', { name: '다시 확인' }))

    expect(previousSignals).toHaveLength(3)
    expect(previousSignals.every((signal) => signal.aborted)).toBe(true)
    await waitFor(() =>
      expect(status('서울 자치구 목록')).toHaveTextContent(
        '조회는 성공했지만 표시할 자치구가 없어요.',
      ),
    )

    await act(async () => {
      previousResponse.resolve(
        success({ items: [{ districtCode: '11110', districtName: '종로구' }] }),
      )
    })
    expect(status('서울 자치구 목록')).toHaveTextContent(
      '조회는 성공했지만 표시할 자치구가 없어요.',
    )
    expect(screen.queryByText('자치구와 코드 보기')).not.toBeInTheDocument()

    const departingResponse = pendingResponse()
    const departingSignals: AbortSignal[] = []
    fetchMock.mockImplementation(async (_, options) => {
      if (options?.signal) departingSignals.push(options.signal)
      return departingResponse.promise
    })
    await user.click(screen.getByRole('button', { name: '다시 확인' }))
    unmount()

    expect(departingSignals).toHaveLength(3)
    expect(departingSignals.every((signal) => signal.aborted)).toBe(true)
  })
})
