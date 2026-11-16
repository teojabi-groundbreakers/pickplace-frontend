import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ResearchForecast } from '../components/ResearchForecast'
import { createDemoAnalysis, defaultRequest } from '../data/demo'
import type { ResearchForecast as Forecast } from '../types/analysis'
import { isAnalysis } from '../lib/validation'

function forecast(): Forecast {
  return {
    mode: 'experimental_research_only',
    method: 'model_inference',
    basePeriod: '2026Q2',
    dataAsOf: '2026-11-04',
    modelVersion: 'research-v1',
    inputValuesVerified: false,
    regionScopeVerified: false,
    predictions: [
      {
        targetPeriod: '2026Q3',
        estimatedYoYGrowth: 0.05,
        reason: null,
        status: 'available',
        estimateKind: 'completed_quarter_unobserved_estimate',
        warnings: ['research_only_not_point_in_time_validated'],
        retrospectiveTest: {
          targetPeriod: '2025Q3',
          rows: 15837,
          maePp: 62.56,
          medianAbsoluteErrorPp: 13.69,
        },
      },
      {
        targetPeriod: '2026Q4',
        estimatedYoYGrowth: null,
        reason: '과거 이력이 부족합니다.',
        status: 'unavailable',
        estimateKind: 'in_progress_or_future_quarter_estimate',
        warnings: [],
      },
    ],
  }
}

describe('research forecast contract', () => {
  it('accepts existing demos and partial quarter results without inventing scores', () => {
    const demo = createDemoAnalysis(defaultRequest)
    expect(isAnalysis(demo)).toBe(true)
    expect(
      isAnalysis({
        ...demo,
        period: '2026Q2',
        scores: { overall: null, growth: null, risk: null, fit: null },
        trends: [],
        researchForecast: forecast(),
      }),
    ).toBe(true)
  })

  it('rejects contradictory status, invalid dates, duplicate periods, and false numeric values', () => {
    const demo = createDemoAnalysis(defaultRequest)
    const invalid = forecast()
    invalid.predictions[1].estimatedYoYGrowth = 0
    expect(isAnalysis({ ...demo, researchForecast: invalid })).toBe(false)
    expect(
      isAnalysis({ ...demo, researchForecast: { ...forecast(), dataAsOf: '2026-02-31' } }),
    ).toBe(false)
    const duplicate = forecast()
    duplicate.predictions[1].targetPeriod = '2026Q3'
    expect(isAnalysis({ ...demo, researchForecast: duplicate })).toBe(false)
    const nonfinite = forecast()
    nonfinite.predictions[0].estimatedYoYGrowth = Infinity
    expect(isAnalysis({ ...demo, researchForecast: nonfinite })).toBe(false)
  })

  it('shows forecasts first and keeps source, warnings and backtest results in a disclosure', async () => {
    const data = forecast()
    data.predictions[0].warnings.push('검토 중인 항목이 있습니다.')
    const user = userEvent.setup()
    render(<ResearchForecast data={data} />)
    expect(screen.getByText('입력 기준')).toBeVisible()
    expect(screen.getByText('2026Q2')).toBeVisible()
    expect(screen.getByRole('heading', { name: '2026Q3' })).toBeVisible()
    expect(screen.getByText('+5.0%')).toBeVisible()
    expect(screen.getByText('전년 동기 대비')).toBeVisible()
    expect(screen.getByRole('heading', { name: '2026Q4' })).toBeVisible()
    expect(screen.getByText('추정 불가')).toBeVisible()
    expect(screen.getByText('과거 이력이 부족합니다.')).toBeVisible()
    expect(screen.getByText(/실제 예측 성능은 검증되지 않았습니다/)).toBeVisible()
    expect(screen.getByText('62.56%p')).not.toBeVisible()

    await user.click(screen.getByText('출처와 검증 상세'))

    expect(screen.getByText(/행정동 코드 대응과 지역별 모델 적용 범위/)).toBeVisible()
    expect(
      screen.getByText(/요청에 사용된 입력값의 출처와 진위는 검증되지 않았습니다/),
    ).toBeVisible()
    expect(screen.getByText('2026-11-04')).toHaveAttribute('datetime', '2026-11-04')
    expect(screen.getByText('평균 절대오차')).toBeVisible()
    expect(screen.getByText('62.56%p')).toBeVisible()
    expect(screen.getByText('검토 중인 항목이 있습니다.')).toBeVisible()
  })

  it('shows a negative estimate and an available zero with their own target quarters', () => {
    const data = forecast()
    data.predictions[0].estimatedYoYGrowth = -0.092136
    data.predictions[1] = {
      ...data.predictions[1],
      estimatedYoYGrowth: 0,
      reason: null,
      status: 'available',
    }
    render(<ResearchForecast data={data} />)
    expect(screen.getByText('-9.2%')).toBeVisible()
    expect(screen.getByText('0.0%')).toBeVisible()
    expect(screen.queryByText('추정 불가')).toBeNull()
  })
})
