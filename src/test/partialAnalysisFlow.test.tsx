import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { createDemoAnalysis, defaultRequest, demoCatalog } from '../data/demo'
import { Dashboard } from '../pages/Dashboard'
import { persistReports, readReports } from '../lib/reports'
import { Saved } from '../pages/Saved'
import type { Analysis } from '../types/analysis'

vi.mock('../components/AreaMap', () => ({
  AreaMap: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}))

const partial: Analysis = {
  ...createDemoAnalysis(defaultRequest),
  source: 'api',
  period: '2026Q2',
  scores: { overall: null, growth: null, risk: null, fit: null },
  factors: [],
  trends: [],
  researchForecast: {
    mode: 'experimental_research_only',
    method: 'model_inference',
    basePeriod: '2026Q2',
    dataAsOf: '2026-11-04',
    modelVersion: 'sha256-example',
    regionScopeVerified: false,
    inputValuesVerified: false,
    predictions: [
      {
        targetPeriod: '2026Q3',
        estimatedYoYGrowth: 0.05,
        status: 'available',
        reason: null,
        estimateKind: 'completed_quarter_unobserved_estimate',
        warnings: ['research_only_not_point_in_time_validated'],
      },
    ],
  },
}

describe('부분 결과 전체 화면 흐름', () => {
  it('점수와 추이가 없더라도 연구용 추정과 미제공 안내를 표시한다', () => {
    render(
      <MemoryRouter>
        <Dashboard
          catalog={demoCatalog}
          catalogError=""
          retryCatalog={() => {}}
          state={{ status: 'success', result: partial }}
          run={async () => {}}
          saved={[]}
          onSave={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('종합점수는 아직 제공되지 않습니다.')).toBeInTheDocument()
    expect(screen.getByText('제공된 추이 데이터가 없습니다.')).toBeInTheDocument()
    expect(screen.getByText(/전년 동기 대비 \+5\.0%/)).toBeInTheDocument()
    expect(screen.getByText(/지역별 학습 범위는 검증되지 않았습니다/)).toBeInTheDocument()
  })

  it('점수 없는 결과를 보존하고 저장 목록에서 미제공으로 보여준다', () => {
    localStorage.clear()
    persistReports([partial])
    expect(readReports()).toEqual([partial])
    render(
      <MemoryRouter>
        <Saved
          reports={readReports()}
          onOpen={() => {}}
          onRemove={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('종합점수 미제공')).toBeInTheDocument()
    expect(screen.getByText('연구용 추정')).toBeInTheDocument()
  })
})
