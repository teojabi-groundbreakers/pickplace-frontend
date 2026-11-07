import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { ReactNode } from 'react'

vi.mock('../components/AreaMap', () => ({
  AreaMap: ({
    onRegionSelect,
    children,
  }: {
    onRegionSelect: (code: string) => void
    children: ReactNode
  }) => (
    <section aria-label="테스트 지도">
      {children}
      <button onClick={() => onRegionSelect('11200650')}>지도에서 성수1가1동 선택</button>
    </section>
  ),
}))
beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('상권 분석 화면 흐름', () => {
  it('분석 전에 지도를 먼저 표시하고 지도 선택을 검색 조건에 반영한다', async () => {
    const user = userEvent.setup()
    render(<App />)
    const map = await screen.findByRole('region', { name: '테스트 지도' })
    expect(within(map).getByRole('combobox', { name: '지역 검색' })).toBeInTheDocument()
    expect(screen.queryByText('종합 상권 점수')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '지도에서 성수1가1동 선택' }))
    expect(screen.getByLabelText('행정동')).toHaveValue('11200650')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    await screen.findByRole('heading', { name: /성동구 성수1가1동/ }, { timeout: 2500 })
    await user.click(screen.getByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('행정동'), '11200690')
    expect(screen.getByText(/아래는 이전 조건의 결과입니다/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '분석 결과 닫기' }))
    expect(screen.queryByRole('complementary', { name: '분석 결과 패널' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '분석 결과 보기' }))
    expect(screen.getByRole('complementary', { name: '분석 결과 패널' })).toBeInTheDocument()
  })

  it('조건 변경 후 재분석, 저장, 목록 조회 및 재열기를 연결한다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11440')
    await user.selectOptions(screen.getByLabelText('행정동'), '11440600')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(screen.getByText('상권의 가능성을 살펴보고 있어요')).toBeInTheDocument()
    await screen.findByRole('heading', { name: /마포구 합정동/ }, { timeout: 2500 })
    await user.click(screen.getByRole('button', { name: '분석 저장' }))
    expect(JSON.parse(localStorage.getItem('pickplace.reports.v1') || '[]')).toHaveLength(1)
    await user.click(screen.getByRole('link', { name: /저장한 분석/ }))
    expect(screen.getByRole('heading', { name: '마포구 합정동' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '분석 다시 보기' }))
    expect(screen.getByLabelText('행정동')).toHaveValue('11440600')
    expect(screen.getByRole('button', { name: '저장됨' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('가이드에서 데이터 부족과 오류 화면을 확인하고 재시도한다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(
      within(screen.getByRole('navigation', { name: '주요 메뉴' })).getByRole('link', {
        name: '이용 가이드',
      }),
    )
    await user.click(screen.getByRole('link', { name: /데이터 부족/ }))
    await screen.findByText('아직 데이터가 충분하지 않아요', {}, { timeout: 2500 })
    await user.click(
      within(screen.getByRole('navigation', { name: '주요 메뉴' })).getByRole('link', {
        name: '이용 가이드',
      }),
    )
    await user.click(screen.getByRole('link', { name: /서버 오류/ }))
    await screen.findByText('분석을 완료하지 못했어요', {}, { timeout: 2500 })
    await user.click(screen.getByRole('button', { name: '다시 시도하기' }))
    await waitFor(
      () => expect(screen.getByRole('heading', { name: /성동구 성수2가1동/ })).toBeInTheDocument(),
      { timeout: 2500 },
    )
  })
})

describe('서비스 소개 내비게이션', () => {
  it('배너에서 소개와 사용법으로 이동하며 사이드바 상태와 주요 메뉴를 유지한다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('region', { name: '테스트 지도' })

    await user.click(screen.getByRole('button', { name: '사이드바 펼치기' }))
    await user.click(screen.getByRole('button', { name: '내비게이션 열기' }))
    expect(screen.getByRole('button', { name: '내비게이션 열기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.click(
      within(screen.getByLabelText('사이드바')).getByRole('link', { name: 'PickPlace 소개' }),
    )

    expect(window.location.pathname).toBe('/about')
    expect(
      screen.getByRole('heading', { level: 1, name: '좋은 시작을 위한 좋은 자리' }),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('PickPlace 소개')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내비게이션 열기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByRole('button', { name: '사이드바 접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    const navigation = screen.getByRole('navigation', { name: '주요 메뉴' })
    expect(within(navigation).getAllByRole('link')).toHaveLength(3)
    expect(within(navigation).getByRole('link', { name: '이용 가이드' })).toHaveAttribute(
      'href',
      '/guide',
    )

    await user.click(screen.getByRole('link', { name: '이용 방법 보기' }))
    expect(window.location.pathname).toBe('/guide')
    expect(
      screen.getByRole('heading', { level: 1, name: /가능성을 읽는 방법/ }),
    ).toBeInTheDocument()
  })

  it('소개 주소에 직접 진입한 뒤 지도로 이동할 수 있다', async () => {
    window.history.replaceState({}, '', '/about')
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { level: 1, name: '좋은 시작을 위한 좋은 자리' })
    expect(within(screen.getByRole('banner')).getByText('PickPlace 소개')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '지도에서 시작하기' }))

    expect(window.location.pathname).toBe('/')
    expect(await screen.findByRole('region', { name: '테스트 지도' })).toBeInTheDocument()
  })
})
