import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AiDiagnosis } from '../components/AiDiagnosis'
import { toAnalysis } from '../lib/aiAnalysis'
import { buildReportText, persistReports, readReports } from '../lib/reports'
import { Saved } from '../pages/Saved'
import { aiPeriodTestEnvelope, aiTestContext, aiTestEnvelope, aiTestRequest } from './aiFixtures'

function indicatorCard(heading: string) {
  const card = screen.getByRole('heading', { name: heading }).closest('article')
  if (!card) throw new Error(`지표 카드 없음: ${heading}`)
  return within(card)
}

describe('AI 부분 결과 안내와 보고서', () => {
  it('AI 호출 실패 상태와 한국어 사유를 표시한다', () => {
    const data = aiTestEnvelope(aiTestRequest, 'FAILED').data
    data.ai.reason = 'ai_timeout'
    data.ai.transportStatus = 'UNAVAILABLE'
    render(<AiDiagnosis data={{ ...data, requestId: 'failed-test' }} />)
    expect(screen.getByText('AI 응답 실패')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('AI 서버의 응답 시간이 초과되었습니다.')
    expect(screen.queryByText('42.0 / 100')).not.toBeInTheDocument()
  })

  it('기존 v1 저장본을 다시 읽고 지표별 기준 분기와 주의사항을 보고서에 남긴다', () => {
    const envelope = aiTestEnvelope()
    const legacy = toAnalysis(aiTestRequest, envelope.data, envelope.meta.requestId, aiTestContext)
    localStorage.setItem('pickplace.reports.v1', JSON.stringify([legacy]))
    const [restored] = readReports()
    expect(restored).toEqual(legacy)
    expect(restored.period).toBe('2026Q3')

    const report = buildReportText(restored)
    expect(report).toContain('매출 성장률 추정 (2026Q3 기준 · 예측 대상 2026Q4 · 비교 2025Q4)')
    expect(report).toContain('제공 불가 (사용 가능한 예측 모델 파일이 없습니다.)')
    expect(report).toContain('해석 시 주의: 위험·적합도 지수는 검증 중인 초안입니다.')
  })

  it('AI 호출 실패가 다른 분기의 지표와 기본 통계를 가리지 않는다', () => {
    const { data, meta } = aiPeriodTestEnvelope()
    data.ai.state = 'FAILED'
    data.ai.reason = 'ai_timeout'
    render(<AiDiagnosis data={{ ...data, requestId: meta.requestId }} />)

    expect(screen.getByText(/정보 기준일 2026-11-16/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('AI 서버의 응답 시간이 초과되었습니다.')
    const growth = indicatorCard('매출 성장률 추정')
    expect(growth.getByText('2026Q2 기준')).toBeInTheDocument()
    expect(growth.getByText('예측 대상 2026Q3 · 비교 2025Q3')).toBeInTheDocument()
    expect(growth.getByText(/예측 대상 분기가 분석 기준일보다 이후가 아닙니다/)).toBeInTheDocument()
    const risk = indicatorCard('위험 지수')
    expect(risk.getByText('2026Q2 기준')).toBeInTheDocument()
    expect(risk.getByText('42.0 / 100')).toBeInTheDocument()
    const fit = indicatorCard('업종 적합도 지수')
    expect(fit.getByText('2026Q3 기준')).toBeInTheDocument()
    expect(fit.getByText('65.0 / 100')).toBeInTheDocument()
    expect(screen.getByText('상주인구')).toBeInTheDocument()
    expect(screen.getByText(/100명/)).toBeInTheDocument()
    expect(screen.getByText(/자료의 사용 승인을 확인하지 못했습니다/)).toBeInTheDocument()

    const report = buildReportText(toAnalysis(aiTestRequest, data, meta.requestId, aiTestContext))
    expect(report).toContain('매출 성장률 추정 (2026Q2 기준 · 예측 대상 2026Q3 · 비교 2025Q3)')
    expect(report).toContain('위험 지수 (초안) (2026Q2 기준): 42.0 / 100')
    expect(report).toContain('업종 적합도 지수 (초안) (2026Q3 기준): 65.0 / 100')
    expect(report).toContain('자료의 사용 승인을 확인하지 못했습니다.')
  })

  it('적합도만 제공되는 경우 0점과 기준 미확정 지표를 구분하고 저장 후 다시 연다', () => {
    const { data, meta } = aiPeriodTestEnvelope()
    data.ai.metrics.growth = {
      basePeriod: null,
      targetPeriod: null,
      comparisonPeriod: null,
      status: 'unavailable',
      value: null,
      reason: 'missing_base_period',
    }
    data.ai.metrics.risk = {
      basePeriod: null,
      status: 'unavailable',
      value: null,
      reason: 'missing_risk_indicators',
    }
    data.ai.metrics.fit = { basePeriod: '2026Q3', status: 'available', value: 0, reason: null }

    const analysis = toAnalysis(aiTestRequest, data, meta.requestId, aiTestContext)
    persistReports([analysis])
    const reports = readReports()
    expect(reports).toEqual([analysis])

    const open = vi.fn()
    render(
      <MemoryRouter>
        <Saved
          reports={reports}
          onOpen={open}
          onRemove={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/정보 기준일 2026-11-16/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '분석 다시 보기' }))
    expect(open).toHaveBeenCalledWith(analysis)

    render(<AiDiagnosis data={{ ...data, requestId: meta.requestId }} />)
    const growth = indicatorCard('매출 성장률 추정')
    expect(growth.getByText('기준 분기 미확정')).toBeInTheDocument()
    expect(growth.getByText(/기준 분기의 자료가 없습니다/)).toBeInTheDocument()
    expect(growth.queryByText(/예측 대상/)).not.toBeInTheDocument()
    const risk = indicatorCard('위험 지수')
    expect(risk.queryByText('0.0 / 100')).not.toBeInTheDocument()
    const fit = indicatorCard('업종 적합도 지수')
    expect(fit.getByText('0.0 / 100')).toBeInTheDocument()
  })
})
