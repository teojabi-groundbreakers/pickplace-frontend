import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReferenceSearch } from '../lib/useReferenceSearch'

const api = vi.hoisted(() => ({ getAdministrativeDongs: vi.fn() }))
vi.mock('../lib/backendReference', () => api)

const districts = Array.from({ length: 6 }, (_, index) => ({
  districtCode: `111${String(index).padStart(2, '0')}`,
  districtName: `자치구 ${index}`,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('서버 행정동 검색 목록', () => {
  it('검색이 활성화됐을 때 동시 요청을 네 개로 제한하고 종료 시 나머지를 취소한다', async () => {
    const pending: Array<(value: { items: never[]; requestId: string }) => void> = []
    api.getAdministrativeDongs.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve)
        }),
    )
    const { rerender } = renderHook(({ active }) => useReferenceSearch(districts, active), {
      initialProps: { active: false },
    })
    expect(api.getAdministrativeDongs).not.toHaveBeenCalled()
    rerender({ active: true })
    await waitFor(() => expect(api.getAdministrativeDongs).toHaveBeenCalledTimes(4))
    const signals = api.getAdministrativeDongs.mock.calls.map(([, signal]) => signal as AbortSignal)
    expect(signals.every((signal) => !signal.aborted)).toBe(true)
    await act(async () => pending[0]({ items: [], requestId: 'test-request' }))
    await waitFor(() => expect(api.getAdministrativeDongs).toHaveBeenCalledTimes(5))
    rerender({ active: false })
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    const fifthSignal = api.getAdministrativeDongs.mock.calls[4][1] as AbortSignal
    expect(fifthSignal.aborted).toBe(true)
    await act(async () => {
      for (const resolve of pending.slice(1)) resolve({ items: [], requestId: 'test-request' })
    })
    expect(api.getAdministrativeDongs).toHaveBeenCalledTimes(5)
  })
})
