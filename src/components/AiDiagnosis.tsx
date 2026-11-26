import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import type {
  AiAnalysisDisplay,
  AiPeriodGrowth,
  AiPeriodMetric,
  AnalysisRequest,
  RegionalSummary,
} from '../types/analysis'
import { aiDisplayMetrics, aiReasonText, aiWarningText } from '../lib/aiAnalysis'
import {
  aiBasePeriodText,
  aiDraftScoreNote,
  aiFitDirection,
  aiGrowthPeriodsText,
  aiGrowthValueText,
  aiLocationNote,
  aiReferenceScopeNote,
  aiReferenceScopeText,
  aiRequestNoticeText,
  aiRequestStatusText,
  aiRiskDirection,
  aiStatisticsRows,
  fitReferenceBasisNote,
  regionalSummaryRows,
  researchForecastNote,
  researchGrowthFormat,
} from '../lib/aiPresentation'
import {
  getLocalResearchForecast,
  type LocalResearchResult,
  type LocalResearchState,
} from '../lib/localResearchForecast'
import { useFitReference, type FitReferenceState } from '../lib/useFitReference'
import { FitReferenceBenchmark, FitReferenceIndicators } from './FitComparison'
import { Badge } from './ui'
import './ai-diagnosis.css'

function IndicatorHeading({ title, value }: { title: string; value: string | null }) {
  return (
    <header className="ai-indicator-heading">
      <h3>{title}</h3>
      {value === null ? (
        <p className="ai-indicator-unavailable">제공 불가</p>
      ) : (
        <p className="ai-indicator-value">{value}</p>
      )}
    </header>
  )
}

function GrowthIndicator({
  indicator,
  selection,
  onResearchChange,
}: {
  indicator: AiPeriodGrowth
  selection?: AnalysisRequest
  onResearchChange?: (state: LocalResearchState) => void
}) {
  const [lookup, setLookup] = useState<LocalResearchResult | { status: 'error' } | null>(null)
  const regionCode = selection?.regionCode
  const industryCode = selection?.industryCode
  const useResearch = indicator.status === 'unavailable' && !!regionCode && !!industryCode

  useEffect(() => {
    if (!useResearch || !regionCode || !industryCode) return
    const controller = new AbortController()
    void getLocalResearchForecast({ regionCode, industryCode }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setLookup(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup({ status: 'error' })
      })
    return () => controller.abort()
  }, [industryCode, regionCode, useResearch])

  const research = useResearch && lookup?.status === 'available' ? lookup : null
  const estimate = research?.forecast.predictions.find(
    (prediction) => prediction.targetPeriod === '2026Q4' && prediction.status === 'available',
  )
  const estimatedGrowth = estimate?.estimatedYoYGrowth
  const hasResearch = research !== null && estimate !== undefined && estimatedGrowth != null
  const growthPeriods = aiGrowthPeriodsText(indicator)
  const value = hasResearch
    ? researchGrowthFormat.format(estimatedGrowth)
    : indicator.status === 'available'
      ? aiGrowthValueText(indicator.value)
      : null

  useLayoutEffect(() => {
    if (!onResearchChange) return
    onResearchChange(
      !useResearch
        ? { status: 'idle' }
        : hasResearch
          ? research
          : { status: lookup?.status === 'error' ? 'error' : lookup ? 'unavailable' : 'loading' },
    )
  }, [hasResearch, lookup, onResearchChange, research, useResearch])

  return (
    <article className="ai-indicator">
      <IndicatorHeading
        title="매출 성장률 추정"
        value={value}
      />
      <div className="ai-indicator-details">
        {hasResearch ? (
          <>
            <p className="ai-indicator-period ai-indicator-research">
              <Badge tone="neutral">연구용 추정</Badge>
              <span>{aiBasePeriodText(research.forecast.basePeriod)}</span>
            </p>
            <p className="ai-indicator-comparison">{estimate.targetPeriod} 추정 · 전년 동기 대비</p>
            <p className="ai-indicator-comparison">{research.scopeLabel}</p>
            <small>{researchForecastNote}</small>
          </>
        ) : (
          <>
            <p className="ai-indicator-period">{aiBasePeriodText(indicator.basePeriod)}</p>
            {growthPeriods && <p className="ai-indicator-comparison">{growthPeriods}</p>}
            {indicator.status === 'unavailable' && (
              <p className="ai-indicator-comparison">{aiReasonText(indicator.reason)}</p>
            )}
            {useResearch && (
              <p
                className="ai-indicator-comparison"
                role="status"
              >
                {!lookup
                  ? '연구용 추정치를 확인 중입니다.'
                  : lookup.status === 'error'
                    ? '연구용 추정치를 불러오지 못했습니다.'
                    : '이 지역·업종의 연구용 추정치를 제공할 수 없습니다.'}
              </p>
            )}
            <small>예측값은 보장된 매출이나 창업 성공 확률이 아닙니다.</small>
          </>
        )}
      </div>
    </article>
  )
}

function DraftIndicator({
  title,
  indicator,
  direction,
  comparison,
}: {
  title: string
  indicator: AiPeriodMetric
  direction: string
  comparison?: ReactNode
}) {
  const value = indicator.status === 'available' ? `${indicator.value.toFixed(1)} / 100` : null

  return (
    <article className="ai-indicator">
      <IndicatorHeading
        title={title}
        value={value}
      />
      <div className="ai-indicator-details">
        {(indicator.basePeriod || !comparison) && (
          <p className="ai-indicator-period">{aiBasePeriodText(indicator.basePeriod)}</p>
        )}
        {indicator.status === 'available' ? (
          <p>{direction}</p>
        ) : (
          <p className="ai-indicator-comparison">{aiReasonText(indicator.reason)}</p>
        )}
        {(indicator.status === 'available' || !comparison) && <small>{aiDraftScoreNote}</small>}
        {comparison}
      </div>
    </article>
  )
}

export function RegionalSummaryCard({ summary }: { summary: RegionalSummary }) {
  return (
    <section
      className="panel ai-diagnosis"
      aria-label="지역·업종 현황"
    >
      <div className="panel-header">
        <h2>지역·업종 현황</h2>
      </div>
      <div className="ai-diagnosis-body">
        <dl className="regional-summary-metrics">
          {regionalSummaryRows(summary).map(
            ({ name, display, available, referenceOn, monthLabel }) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd className={available ? 'regional-summary-value' : undefined}>{display}</dd>
                <dd>
                  <time dateTime={referenceOn}>{monthLabel}</time>
                </dd>
              </div>
            ),
          )}
        </dl>
      </div>
    </section>
  )
}

export function AiDiagnosis({
  data,
  hasRegionalSummary = false,
  localReferenceSelection,
  onResearchChange,
  onFitReferenceChange,
}: {
  data: AiAnalysisDisplay
  hasRegionalSummary?: boolean
  localReferenceSelection?: AnalysisRequest
  onResearchChange?: (state: LocalResearchState) => void
  onFitReferenceChange?: (state: FitReferenceState) => void
}) {
  const { ai, statistics } = data
  const result = aiDisplayMetrics(data)
  const localSelection =
    localReferenceSelection?.regionCode === data.request.regionCode &&
    localReferenceSelection.industryCode === data.request.industryCode
      ? localReferenceSelection
      : undefined
  const referenceScope = aiReferenceScopeText(data)
  const fitReference = useFitReference(result ? localSelection : undefined)
  useLayoutEffect(() => {
    onFitReferenceChange?.(fitReference)
  }, [fitReference, onFitReferenceChange])
  const statisticRows = aiStatisticsRows(statistics, hasRegionalSummary)
  const summary = [
    referenceScope && (hasRegionalSummary || statisticRows.length > 0)
      ? aiReferenceScopeNote
      : null,
    fitReference.status === 'available' ? fitReferenceBasisNote : null,
    ...(result?.warnings.map(aiWarningText) ?? []),
  ].filter((note): note is string => note !== null)
  const requestStatus = aiRequestStatusText(ai, Boolean(result))

  return (
    <>
      <section
        className="panel ai-diagnosis"
        aria-label="AI 분석 상태와 제공 가능한 결과"
      >
        <div className="panel-header">
          <h2>AI 분석 상태</h2>
          <Badge
            tone={ai.state === 'AVAILABLE' ? 'green' : ai.state === 'FAILED' ? 'orange' : 'neutral'}
          >
            {requestStatus}
          </Badge>
        </div>
        <div className="ai-diagnosis-body">
          <p className="ai-as-of">정보 기준일 {data.asOf}</p>
          {statisticRows.length === 0 && !hasRegionalSummary && (
            <p className="ai-data-notice">제공 가능한 통계 값이 아직 없습니다.</p>
          )}
          {statisticRows.length > 0 && (
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
            <p
              className="ai-request-notice"
              role="status"
            >
              {aiRequestNoticeText(ai, Boolean(result))}
            </p>
          )}
          {result && (
            <>
              {referenceScope && <p className="ai-reference-scope">{referenceScope}</p>}
              <div className="ai-indicator-list">
                <GrowthIndicator
                  key={`${data.requestId}:${localSelection?.regionCode ?? ''}:${localSelection?.industryCode ?? ''}`}
                  indicator={result.growth}
                  selection={localSelection}
                  onResearchChange={onResearchChange}
                />
                <DraftIndicator
                  title="위험 지수"
                  indicator={result.risk}
                  direction={aiRiskDirection}
                />
                <DraftIndicator
                  title="업종 적합도 지수"
                  indicator={result.fit}
                  direction={aiFitDirection}
                  comparison={localSelection && <FitReferenceIndicators state={fitReference} />}
                />
              </div>
            </>
          )}
          <p className="ai-location-note">{aiLocationNote}</p>
        </div>
      </section>
      {summary.length > 0 && (
        <section
          className="panel ai-diagnosis"
          aria-label="분석 상태 안내"
        >
          <div className="panel-header">
            <h2>분석 상태 안내</h2>
          </div>
          <ul className="ai-diagnosis-body ai-summary-notes">
            {summary.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
      <FitReferenceBenchmark state={fitReference} />
    </>
  )
}
