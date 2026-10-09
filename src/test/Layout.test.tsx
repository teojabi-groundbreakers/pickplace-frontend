import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Layout } from '../components/Layout'

function mount(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Layout savedCount={2}>
        <Routes>
          <Route
            path="/"
            element={<h1>지도 화면</h1>}
          />
          <Route
            path="/saved"
            element={<h1>저장 화면</h1>}
          />
          <Route
            path="/guide"
            element={<h1>가이드 화면</h1>}
          />
        </Routes>
      </Layout>
    </MemoryRouter>,
  )
}

describe('공통 사이드바', () => {
  it.each(['/', '/saved', '/guide'])('%s에 바로 진입해도 접힌 메뉴로 시작한다', (path) => {
    mount(path)

    const toggle = screen.getByRole('button', { name: '사이드바 펼치기' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', screen.getByLabelText('사이드바').id)
    expect(screen.getByRole('link', { name: 'PickPlace 홈' })).toHaveAttribute('href', '/')
    expect(screen.queryByText('WORKSPACE')).not.toBeInTheDocument()

    const navigation = screen.getByRole('navigation', { name: '주요 메뉴' })
    expect(within(navigation).getAllByRole('link')).toHaveLength(3)
    expect(within(navigation).getByRole('link', { name: '저장한 분석' })).toHaveAttribute(
      'href',
      '/saved',
    )
  })

  it('펼친 상태로 페이지를 이동하고 다시 접을 수 있다', async () => {
    const user = userEvent.setup()
    mount()

    await user.click(screen.getByRole('button', { name: '사이드바 펼치기' }))
    const navigation = screen.getByRole('navigation', { name: '주요 메뉴' })
    await user.click(within(navigation).getByRole('link', { name: '저장한 분석' }))
    expect(screen.getByRole('heading', { name: '저장 화면' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '사이드바 접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    await user.click(within(navigation).getByRole('link', { name: '이용 가이드' }))
    expect(screen.getByRole('heading', { name: '가이드 화면' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))
    await user.click(within(navigation).getByRole('link', { name: '상권 분석' }))
    expect(screen.getByRole('heading', { name: '지도 화면' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '사이드바 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('키보드로 펼치고 접으며 모바일 메뉴 상태는 따로 유지한다', async () => {
    const user = userEvent.setup()
    mount()

    screen.getByRole('button', { name: '사이드바 펼치기' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: '사이드바 접기' })).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: '사이드바 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    await user.click(screen.getByRole('button', { name: '내비게이션 열기' }))
    expect(screen.getByRole('button', { name: '내비게이션 열기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const navigation = screen.getByRole('navigation', { name: '주요 메뉴' })
    await user.click(within(navigation).getByRole('link', { name: '저장한 분석' }))
    expect(screen.getByRole('button', { name: '내비게이션 열기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByRole('button', { name: '사이드바 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
