import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegionBoundary } from '../types/boundary'
import { ApiError } from '../lib/api'
import { getRegionBoundary } from '../lib/regionBoundary'
import { useRegionBoundary } from '../lib/useRegionBoundary'

vi.mock('../lib/regionBoundary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionBoundary')>()),
  getRegionBoundary: vi.fn(),
}))

const mockBoundary = vi.mocked(getRegionBoundary)
const regionCode = '1120067000'

function boundary(code = regionCode): RegionBoundary {
  return {
    regionCode: code,
    regionType: 'H',
    regionName: '테스트 행정동',
    coordinateSystem: 'EPSG:4326',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [127, 37],
          [127.1, 37],
          [127, 37.1],
          [127, 37],
        ],
      ],
    },
    labelPosition: [127.02, 37.02],
    boundaryDate: '2025-06-30',
    source: { name: '테스트 자료', url: 'https://example.com' },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

beforeEach(() => mockBoundary.mockReset())

describe('행정동 경계 요청 상태', () => {
  it('빈 코드·8자리 데모 코드는 idle이며 경계를 요청하지 않는다', () => {
    const { result, rerender } = renderHook(({ code }) => useRegionBoundary(code), {
      initialProps: { code: '' },
    })
    expect(result.current.state).toEqual({ status: 'idle', regionCode: '' })

    rerender({ code: '11200670' })
    expect(result.current.state).toEqual({ status: 'idle', regionCode: '11200670' })
    expect(mockBoundary).not.toHaveBeenCalled()
  })

  it('로딩에서 성공으로 바뀌며 원본 코드와 경계 메타데이터를 보존한다', async () => {
    const request = deferred<RegionBoundary | null>()
    mockBoundary.mockReturnValueOnce(request.promise)
    const { result } = renderHook(() => useRegionBoundary(regionCode))
    expect(result.current.state).toEqual({ status: 'loading', regionCode })

    await act(async () => request.resolve(boundary()))
    expect(result.current.state).toEqual({ status: 'success', regionCode, boundary: boundary() })
  })

  it('이전 지역 경계를 새 지역 로딩 중 숨기고 늦은 결과가 최신 지역을 덮어쓰지 않는다', async () => {
    const secondCode = '1117065000'
    const old = deferred<RegionBoundary | null>()
    const next = deferred<RegionBoundary | null>()
    mockBoundary.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const { result, rerender } = renderHook(({ code }) => useRegionBoundary(code), {
      initialProps: { code: regionCode },
    })
    const oldSignal = mockBoundary.mock.calls[0][1]

    rerender({ code: secondCode })
    expect(oldSignal?.aborted).toBe(true)
    expect(result.current.state).toEqual({ status: 'loading', regionCode: secondCode })

    await act(async () => next.resolve(boundary(secondCode)))
    await act(async () => old.resolve(boundary()))
    expect(result.current.state).toEqual({
      status: 'success',
      regionCode: secondCode,
      boundary: boundary(secondCode),
    })
  })

  it('성공한 경계에서 다른 지역으로 바꿀 때 이전 geometry를 노출하지 않는다', async () => {
    mockBoundary.mockResolvedValueOnce(boundary()).mockReturnValueOnce(new Promise(() => {}))
    const { result, rerender } = renderHook(({ code }) => useRegionBoundary(code), {
      initialProps: { code: regionCode },
    })
    await waitFor(() => expect(result.current.state.status).toBe('success'))

    rerender({ code: '1117065000' })
    expect(result.current.state).toEqual({ status: 'loading', regionCode: '1117065000' })
  })

  it('이전 지역으로 다시 돌아와도 새 조회가 끝나기 전에 과거 성공 경계를 노출하지 않는다', async () => {
    const latest = deferred<RegionBoundary | null>()
    mockBoundary
      .mockResolvedValueOnce(boundary())
      .mockReturnValueOnce(new Promise(() => {}))
      .mockReturnValueOnce(latest.promise)
    const { result, rerender } = renderHook(({ code }) => useRegionBoundary(code), {
      initialProps: { code: regionCode },
    })
    await waitFor(() => expect(result.current.state.status).toBe('success'))

    rerender({ code: '1117065000' })
    rerender({ code: regionCode })
    expect(result.current.state).toEqual({ status: 'loading', regionCode })

    await act(async () => latest.resolve(boundary()))
    expect(result.current.state.status).toBe('success')
  })

  it('경계 없음은 empty, 서버 오류는 error이며 재시도는 같은 H 코드로 요청한다', async () => {
    mockBoundary
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new ApiError('경계 서버 오류', 503, 'SERVER_ERROR'))
      .mockResolvedValueOnce(boundary())
    const { result } = renderHook(() => useRegionBoundary(regionCode))
    await waitFor(() => expect(result.current.state).toEqual({ status: 'empty', regionCode }))

    act(() => result.current.retry())
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'error',
        regionCode,
        message: '경계 서버 오류',
      }),
    )

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.state.status).toBe('success'))
    expect(mockBoundary.mock.calls.map(([code]) => code)).toEqual([
      regionCode,
      regionCode,
      regionCode,
    ])
  })

  it('조회 해제와 언마운트에서 요청을 취소하고 뒤늦은 실패를 상태에 반영하지 않는다', async () => {
    const first = deferred<RegionBoundary | null>()
    const second = deferred<RegionBoundary | null>()
    mockBoundary.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender, unmount } = renderHook(({ code }) => useRegionBoundary(code), {
      initialProps: { code: regionCode },
    })
    const firstSignal = mockBoundary.mock.calls[0][1]

    rerender({ code: '' })
    expect(firstSignal?.aborted).toBe(true)
    await act(async () => first.reject(new Error('이전 요청 실패')))
    expect(result.current.state).toEqual({ status: 'idle', regionCode: '' })

    rerender({ code: regionCode })
    const secondSignal = mockBoundary.mock.calls[1][1]
    unmount()
    expect(secondSignal?.aborted).toBe(true)
    await act(async () => second.reject(new Error('해제 후 실패')))
  })
})
