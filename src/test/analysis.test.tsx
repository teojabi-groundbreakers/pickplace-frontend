import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { analyze, ApiError } from '../lib/api'
import { useAnalysis } from '../lib/useAnalysis'
import { createDemoAnalysis, defaultRequest } from '../data/demo'

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  analyze: vi.fn(),
}))
const mockAnalyze = vi.mocked(analyze)

describe('분석 요청 상태', () => {
  it('늦게 도착한 이전 요청이 최신 결과를 덮어쓰지 않는다', async () => {
    let resolveFirst!: (result: ReturnType<typeof createDemoAnalysis>) => void
    const secondRequest = { ...defaultRequest, regionCode: '11440600' }
    mockAnalyze.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    mockAnalyze.mockResolvedValueOnce(createDemoAnalysis(secondRequest))
    const { result } = renderHook(useAnalysis)
    let first!: Promise<void>
    act(() => {
      first = result.current.run(defaultRequest)
    })
    expect(result.current.state.status).toBe('loading')
    await act(async () => {
      await result.current.run(secondRequest)
    })
    await act(async () => {
      resolveFirst(createDemoAnalysis(defaultRequest))
      await first
    })
    expect(result.current.state).toMatchObject({
      status: 'success',
      result: { request: secondRequest },
    })
    expect(mockAnalyze.mock.calls[0][1]?.aborted).toBe(true)
  })

  it('데이터 부족을 서버 오류와 구분한다', async () => {
    mockAnalyze.mockRejectedValueOnce(new ApiError('표본 부족', 422, 'INSUFFICIENT_DATA'))
    const { result } = renderHook(useAnalysis)
    await act(async () => {
      await result.current.run(defaultRequest)
    })
    expect(result.current.state.status).toBe('empty')
    mockAnalyze.mockRejectedValueOnce(new ApiError('서버 장애', 503))
    await act(async () => {
      await result.current.run(defaultRequest)
    })
    expect(result.current.state).toMatchObject({ status: 'error', message: '서버 장애' })
  })
})
