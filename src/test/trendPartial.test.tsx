import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrendChart } from '../components/TrendChart'
import { createDemoAnalysis, defaultRequest } from '../data/demo'
import { isAnalysis } from '../lib/validation'
import type { TrendPoint } from '../types/analysis'

function row(month: string, sales: number | null): TrendPoint {
  return {
    month,
    sales,
    population: null,
    stores: null,
    openings: null,
    closures: 0,
    averageSales: null,
  }
}

describe('partially available monthly data', () => {
  it('accepts explicit null values but rejects missing fields and invalid numbers', () => {
    const analysis = createDemoAnalysis(defaultRequest)
    expect(isAnalysis({ ...analysis, trends: [row('2026-01', null)] })).toBe(true)
    expect(isAnalysis({ ...analysis, trends: [{ ...row('2026-01', null), population: -1 }] })).toBe(
      false,
    )
    expect(isAnalysis({ ...analysis, trends: [{ ...row('2026-01', null), sales: NaN }] })).toBe(
      false,
    )
    const missing: Partial<TrendPoint> = row('2026-01', null)
    delete missing.population
    expect(isAnalysis({ ...analysis, trends: [missing] })).toBe(false)
  })

  it('never joins a missing value and makes null visible instead of zero', () => {
    const { container } = render(
      <TrendChart trends={[row('2026-01', 100), row('2026-02', null), row('2026-03', 200)]} />,
    )
    const lines = container.querySelectorAll('polyline[stroke="#4f7961"]')
    expect(lines).toHaveLength(2)
    expect(
      Array.from(lines).every((line) => line.getAttribute('points')?.split(' ').length === 1),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '데이터 보기' }))
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('제공되지 않음').length).toBeGreaterThan(1)
    expect(within(table).getAllByText('0').length).toBe(3)
  })

  it('does not connect points across an omitted calendar month', () => {
    const { container } = render(<TrendChart trends={[row('2026-01', 100), row('2026-03', 200)]} />)
    expect(container.querySelectorAll('polyline[stroke="#4f7961"]')).toHaveLength(2)
  })

  it('shows no latest value and no change when either endpoint is missing', () => {
    const { container } = render(
      <TrendChart trends={[row('2026-01', 100), row('2026-02', null)]} />,
    )
    expect(
      within(container.querySelector('.chart-summary') as HTMLElement).getByText('제공되지 않음'),
    ).toBeInTheDocument()
    expect(screen.getByText('계산 불가')).toBeInTheDocument()
  })

  it('keeps available store counts when opening or closing counts are missing', () => {
    const first = { ...row('2026-01', null), stores: 10, openings: 2, closures: null }
    const second = { ...row('2026-02', null), stores: null, openings: null, closures: 0 }
    const { container } = render(<TrendChart trends={[first, second]} />)
    fireEvent.click(screen.getByRole('tab', { name: '점포 변화' }))
    expect(container.querySelectorAll('rect[fill="#6b8e76"]')).toHaveLength(1)
    expect(container.querySelectorAll('rect[fill="#c9d0c1"]')).toHaveLength(1)
    expect(screen.getByText('계산 불가')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '데이터 보기' }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('10')).toBeInTheDocument()
    expect(within(table).getByText('2')).toBeInTheDocument()
    expect(within(table).getByText('0')).toBeInTheDocument()
  })
})
