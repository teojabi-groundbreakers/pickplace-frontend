import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoAnalysis, defaultRequest } from '../data/demo'
import { TrendChart } from '../components/TrendChart'
import { ScoreCards } from '../components/ScoreCards'
import { persistReports, readReports } from '../lib/reports'

const analysis = createDemoAnalysis(defaultRequest)
beforeEach(() => localStorage.clear())

describe('결과 컴포넌트', () => {
  it('위험도는 낮을수록 안정적임을 명확히 표시한다', () => {
    render(<ScoreCards analysis={analysis} />)
    expect(screen.getByText('낮을수록 안정적인 상권이에요')).toBeInTheDocument()
    expect(screen.getByText('A등급')).toBeInTheDocument()
  })
  it('기간 및 지표를 바꾸고 원본 수치를 확인한다', async () => {
    const user = userEvent.setup()
    render(<TrendChart trends={analysis.trends} />)
    await user.click(screen.getByRole('button', { name: '12개월' }))
    await user.click(screen.getByRole('tab', { name: '유동인구' }))
    expect(screen.getByText('일평균 유동인구')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '점포 변화' }))
    expect(screen.getByText('전체 점포 수')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '데이터 보기' }))
    expect(screen.getAllByRole('row')).toHaveLength(13)
    expect(screen.getByText('2025-10')).toBeInTheDocument()
  })
  it('기준값이 0이면 변화 없음이 아닌 계산 불가를 표시한다', () => {
    const trends = analysis.trends.slice(-2).map((point) => ({ ...point }))
    trends[0].sales = 0
    trends[1].sales = 100
    render(<TrendChart trends={trends} />)
    expect(screen.getByText('계산 불가')).toBeInTheDocument()
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument()
  })
  it('추이 데이터가 없으면 차트 대신 안내를 표시한다', () => {
    render(<TrendChart trends={[]} />)
    expect(screen.getByText('표시할 추이 데이터가 없습니다.')).toBeInTheDocument()
  })
  it('지표 탭을 키보드로 선택하고 차트 지점을 활성화한다', async () => {
    const user = userEvent.setup()
    render(<TrendChart trends={analysis.trends} />)
    const sales = screen.getByRole('tab', { name: '매출 추이' })
    sales.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: '유동인구' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '유동인구' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: '점포 변화' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(sales).toHaveFocus()
    const firstPoint = screen.getAllByRole('button', { name: /\d{4}-\d{2}:/ })[0]
    fireEvent.keyDown(firstPoint, { key: 'Enter' })
    expect(firstPoint.querySelector('circle:last-child')).toHaveAttribute('r', '5')
  })
})

describe('분석 저장', () => {
  it('브라우저 저장소에서 결과를 복원한다', () => {
    persistReports([analysis])
    expect(readReports()).toEqual([analysis])
  })
  it('손상되거나 이전 형식인 저장 데이터를 무시한다', () => {
    localStorage.setItem('pickplace.reports.v1', '{bad')
    expect(readReports()).toEqual([])
    localStorage.setItem('pickplace.reports.v1', JSON.stringify([{ id: 'bad' }, analysis]))
    expect(readReports()).toEqual([analysis])
  })
})
