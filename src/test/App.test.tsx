import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

vi.mock('../components/AreaMap', () => ({
  AreaMap: ({ onRegionSelect }: { onRegionSelect: (code: string) => void }) => (
    <section aria-label="테스트 지도">
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
    const form = await screen.findByRole('form', { name: '상권 분석 조건' })
    expect(map.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('종합 상권 점수')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '지도에서 성수1가1동 선택' }))
    expect(screen.getByLabelText('행정동')).toHaveValue('11200650')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    await screen.findByRole('heading', { name: /성동구 성수1가1동/ }, { timeout: 2500 })
    await user.selectOptions(screen.getByLabelText('행정동'), '11200690')
    expect(screen.getByText(/아래는 이전 조건의 결과입니다/)).toBeInTheDocument()
  })

  it('조건 변경 후 재분석, 저장, 목록 조회 및 재열기를 연결한다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), '11440')
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
