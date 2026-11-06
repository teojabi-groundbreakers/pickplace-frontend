import type { ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { demoCatalog } from '../data/demo'
import { Dashboard } from '../pages/Dashboard'
import type { AnalysisState } from '../lib/useAnalysis'

vi.mock('../components/AreaMap', () => ({
  AreaMap: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}))

const analysisState: AnalysisState = {
  status: 'error',
  request: { regionCode: '11110515', industryCode: 'coffee' },
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
  return render(
    <MemoryRouter>
      <main>
        <Dashboard
          catalog={demoCatalog}
          catalogError=""
          retryCatalog={() => {}}
          state={analysisState}
          run={async () => {}}
          saved={[]}
          onSave={() => {}}
        />
      </main>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  overlayHeight = 120
  resizeObservers.length = 0
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.classList.contains('map-search-overlay')) return new DOMRect(0, 70, 350, overlayHeight)
    if (this.tagName === 'MAIN') return new DOMRect(0, 56, 390, 788)
    return new DOMRect()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('결과 패널 위치 측정', () => {
  it('검색창 높이를 반영하고 관찰자와 변수를 정리한다', async () => {
    const { container, unmount } = fixture()
    const main = container.querySelector('main')!
    await waitFor(() => expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('134px'))
    const overlay = container.querySelector('.map-search-overlay')!
    const observer = resizeObservers[0]
    expect(observer.observed.has(main)).toBe(true)
    expect(observer.observed.has(overlay)).toBe(true)

    overlayHeight = 200
    act(() => observer.trigger())
    expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('214px')

    unmount()
    expect(observer.disconnected).toBe(true)
    expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('')
  })

  it('결과를 접은 동안 검색창이 바뀌어도 다시 열 때 최신 높이를 유지한다', async () => {
    const user = userEvent.setup()
    const { container } = fixture()
    const main = container.querySelector('main')!
    await waitFor(() => expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('134px'))
    const observer = resizeObservers[0]

    await user.click(screen.getByRole('button', { name: '분석 결과 접기' }))
    expect(screen.queryByRole('complementary', { name: '분석 결과 패널' })).not.toBeInTheDocument()
    overlayHeight = 175
    act(() => observer.trigger())
    expect(main.style.getPropertyValue('--mobile-search-bottom')).toBe('189px')
    await user.click(screen.getByRole('button', { name: '분석 결과 보기' }))
    expect(screen.getByRole('complementary', { name: '분석 결과 패널' })).toBeInTheDocument()
  })
})
