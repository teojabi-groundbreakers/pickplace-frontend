import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
  document.querySelectorAll('script[src*="dapi.kakao.com"]').forEach((script) => script.remove())
  delete window.kakao
})

describe('카카오지도 SDK 로더', () => {
  it('키 미설정 시 스크립트를 요청하지 않는다', async () => {
    const { loadKakaoMaps } = await import('../lib/kakaoMaps')
    await expect(loadKakaoMaps('')).rejects.toThrow('앱 키')
    expect(document.querySelector('script[src*="dapi.kakao.com"]')).toBeNull()
  })
  it('동시 호출을 공유하며 로드 오류 후 재시도할 수 있다', async () => {
    const { loadKakaoMaps } = await import('../lib/kakaoMaps')
    const first = loadKakaoMaps('test-key')
    expect(loadKakaoMaps('test-key')).toBe(first)
    const error = first.catch((value) => value)
    document.querySelector('script[src*="dapi.kakao.com"]')!.dispatchEvent(new Event('error'))
    expect(await error).toBeInstanceOf(Error)
    const second = loadKakaoMaps('test-key')
    expect(second).not.toBe(first)
    const secondError = second.catch((value) => value)
    document.querySelector('script[src*="dapi.kakao.com"]')!.dispatchEvent(new Event('error'))
    await secondError
  })
  it('SDK 무응답이 무한 로딩을 만들지 않는다', async () => {
    vi.useFakeTimers()
    const { loadKakaoMaps } = await import('../lib/kakaoMaps')
    const failure = loadKakaoMaps('test-key').catch((value) => value)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await failure).toBeInstanceOf(Error)
    expect(document.querySelector('script[src*="dapi.kakao.com"]')).toBeNull()
  })
})
