import { render, screen } from '@testing-library/react'
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
