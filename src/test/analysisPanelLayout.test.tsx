import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalysisPanel } from '../components/AnalysisPanel'
import type { AnalysisState } from '../lib/useAnalysis'

const analysisState: AnalysisState = {
  status: 'error',
  request: { regionCode: '1111051500', industryCode: 'CS100010' },
  message: '연결을 확인해 주세요.',
}

let overlayHeight = 120
const resizeObservers: TestResizeObserver[] = []

class TestResizeObserver {
  observed = new Set<Element>()
  disconnected = false
  callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    resizeObservers.push(this)
  }

  observe(element: Element) {
    this.observed.add(element)
  }

  unobserve(element: Element) {
    this.observed.delete(element)
  }

  disconnect() {
    this.disconnected = true
    this.observed.clear()
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

function fixture() {
  function TestLayout() {
    const [dismissed, setDismissed] = useState<AnalysisState | null>(null)

    return (
      <main>
        <div className="map-search-overlay">검색 조건</div>
        <AnalysisPanel
          state={analysisState}
          run={async () => {}}
          saved={[]}
          onSave={() => {}}
          resultMatchesSelection={false}
          dismissedState={dismissed}
          setDismissedState={setDismissed}
        />
      </main>
    )
  }

  return render(<TestLayout />)
}

beforeEach(() => {
  overlayHeight = 120
  resizeObservers.length = 0
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.classList.contains('map-search-overlay')) {
      return new DOMRect(0, 70, 350, overlayHeight)
    }
    if (this.tagName === 'MAIN') return new DOMRect(0, 56, 390, 788)
    return new DOMRect()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('결과 패널 위치 측정', () => {
  it('검색창 높이 변경을 반영하고 해제할 때 관찰자와 변수를 정리한다', () => {
    const { container, unmount } = fixture()
    const main = container.querySelector('main')!
    const overlay = container.querySelector('.map-search-overlay')!
    const resizeObserver = resizeObservers[0]

    expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('134px')
    expect(resizeObserver.observed.has(main)).toBe(true)
    expect(resizeObserver.observed.has(overlay)).toBe(true)

    overlayHeight = 200
    act(() => resizeObserver.trigger())
    expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('214px')

    unmount()
    expect(resizeObserver.disconnected).toBe(true)
    expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('')
  })

  it('결과를 접은 동안 검색창이 바뀌어도 다시 열 때 최신 높이를 유지한다', async () => {
    const user = userEvent.setup()
    const { container } = fixture()
    const main = container.querySelector('main')!
    const resizeObserver = resizeObservers[0]

    await user.click(screen.getByRole('button', { name: '분석 결과 접기' }))
    expect(screen.queryByRole('complementary', { name: '분석 결과 패널' })).not.toBeInTheDocument()

    overlayHeight = 175
    act(() => resizeObserver.trigger())
    expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('189px')

    await user.click(screen.getByRole('button', { name: '분석 결과 보기' }))
    expect(screen.getByRole('complementary', { name: '분석 결과 패널' })).toBeInTheDocument()
    expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('189px')
  })
})
