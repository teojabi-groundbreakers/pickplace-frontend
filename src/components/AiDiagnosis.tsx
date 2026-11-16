import type { AiAnalysisDisplay, AiPeriodMetric } from '../types/analysis'
import { aiDisplayMetrics, aiReasonText, aiWarningText } from '../lib/aiAnalysis'
import { aiBasePeriodText, aiGrowthPeriodsText, aiStatisticsRows } from '../lib/aiPresentation'
import './ai-diagnosis.css'

const stateLabels = {
  SKIPPED: 'AI 요청 보류',
  FAILED: 'AI 응답 실패',
  AVAILABLE: 'AI 응답 확인',
}

function DraftIndicator({
  title,
  indicator,
  direction,
}: {
  title: string
  indicator: AiPeriodMetric
  direction: string
}) {
  return (
    <article className="ai-indicator">
      <h3>{title}</h3>
      <p>{aiBasePeriodText(indicator.basePeriod)}</p>
      {indicator.status === 'available' ? (
        <>
          <p className="ai-indicator-value">{indicator.value.toFixed(1)} / 100</p>
          <p>{direction}</p>
        </>
      ) : (
        <p>제공 불가: {aiReasonText(indicator.reason)}</p>
      )}
      <small>규칙 기반 초안 지수 · 성공률이나 폐업 확률이 아닙니다.</small>
    </article>
  )
}

export function AiDiagnosis({ data }: { data: AiAnalysisDisplay }) {
  const { ai, statistics } = data
  const result = aiDisplayMetrics(data)
  const growthPeriods = result ? aiGrowthPeriodsText(result.growth) : ''
  const statisticRows = aiStatisticsRows(statistics)
  const requestStatus =
    result && ai.state === 'FAILED' ? 'AI 요청 실패 기록' : stateLabels[ai.state]

  return (
    <section
      className="panel ai-diagnosis"
      aria-label="AI 분석 상태와 제공 가능한 결과"
    >
      <div className="panel-header">
        <h2>AI 분석 상태</h2>
        <span>{requestStatus}</span>
      </div>
      <p>정보 기준일 {data.asOf}</p>
      {statisticRows.length === 0 ? (
        <p className="ai-data-notice">제공 가능한 통계 값이 아직 없습니다.</p>
      ) : (
        <div className="ai-statistics">
          <h3>기본 통계</h3>
          <dl>
            {statisticRows.map(({ key, name, display }) => (
              <div key={key}>
                <dt>{name}</dt>
                <dd>{display}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {ai.state !== 'AVAILABLE' && (
        <p role="status">
          {!result &&
            (ai.state === 'SKIPPED'
              ? 'AI 요청을 보내지 않았습니다. '
              : 'AI 결과를 받지 못했습니다. ')}
          {aiReasonText(ai.reason)}
        </p>
      )}
      {result && (
        <>
          <div className="ai-indicator-grid">
            <article className="ai-indicator">
              <h3>매출 성장률 추정</h3>
              <p>{aiBasePeriodText(result.growth.basePeriod)}</p>
              {growthPeriods && <p>{growthPeriods}</p>}
              {result.growth.status === 'available' ? (
                <p className="ai-indicator-value">
                  {result.growth.value >= 0 ? '+' : ''}
                  {(result.growth.value * 100).toFixed(1)}%
                </p>
              ) : (
                <p>제공 불가: {aiReasonText(result.growth.reason)}</p>
              )}
              <small>예측값은 보장된 매출이나 창업 성공 확률이 아닙니다.</small>
            </article>
            <DraftIndicator
              title="위험 지수"
              indicator={result.risk}
              direction="높을수록 위험 신호가 큽니다."
            />
            <DraftIndicator
              title="업종 적합도 지수"
              indicator={result.fit}
              direction="높을수록 초안 기준에서 긍정적입니다."
            />
          </div>
          {result.warnings.length > 0 && (
            <div className="ai-warnings">
              <h3>결과 해석 시 확인할 점</h3>
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{aiWarningText(warning)}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <p className="ai-location-note">
        지도 중심은 사용자가 선택한 카카오 지도 위치이며, 공식 행정동 대표점이나 경계를 뜻하지
        않습니다.
      </p>
    </section>
  )
}
