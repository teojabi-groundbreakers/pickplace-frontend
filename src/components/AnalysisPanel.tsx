import { useLayoutEffect, useRef } from 'react'
import { ArrowDownToLine, Bookmark, ChevronRight, MapPin, PanelRightOpen, X } from 'lucide-react'
import type { Analysis, AnalysisRequest, DemoScenario } from '../types/analysis'
import type { AnalysisState } from '../lib/useAnalysis'
import { downloadReport } from '../lib/reports'
import { ScoreCards } from './ScoreCards'
import { TrendChart } from './TrendChart'
import { ResearchForecast } from './ResearchForecast'
import { Factors, Summary, Competition } from './Insights'
import { Badge, Button, EmptyState } from './ui'

export function AnalysisPanel({
  state,
  run,
  saved,
  onSave,
  resultMatchesSelection,
  dismissedState,
  setDismissedState,
}: {
  state: AnalysisState
  run: (request: AnalysisRequest, scenario?: DemoScenario) => Promise<void>
  saved: Analysis[]
  onSave: (analysis: Analysis) => void
  resultMatchesSelection: boolean
  dismissedState: AnalysisState | null
  setDismissedState: (state: AnalysisState | null) => void
}) {
  const panelToggle = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const panelOpen = state.status !== 'idle' && dismissedState !== state
  const result = state.status === 'success' ? state.result : null

  useLayoutEffect(() => {
    const main = panelRef.current?.closest('main')
    if (!main) return

    let overlay: HTMLElement | null = null
    const update = () => {
      if (!overlay) return
      const overlayRect = overlay.getBoundingClientRect()
      if (overlayRect.height <= 0) return
      const bottom = Math.max(0, Math.ceil(overlayRect.bottom - main.getBoundingClientRect().top))
      main.style.setProperty('--mobile-search-bottom', `${bottom}px`)
    }
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    resizeObserver?.observe(main)
    const observeOverlay = () => {
      const current = main.querySelector<HTMLElement>('.map-search-overlay')
      if (current !== overlay) {
        if (overlay) resizeObserver?.unobserve(overlay)
        overlay = current
        if (overlay) resizeObserver?.observe(overlay)
      }
      update()
    }
    const mutationObserver = new MutationObserver(observeOverlay)
    mutationObserver.observe(main, { childList: true, subtree: true })
    window.addEventListener('resize', update)
    observeOverlay()
    return () => {
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', update)
      main.style.removeProperty('--mobile-search-bottom')
    }
  }, [])

  return (
    <>
      {state.status !== 'idle' && (
        <button
          ref={panelToggle}
          type="button"
          className="map-results-toggle"
          aria-expanded={panelOpen}
          aria-controls="map-analysis-panel"
          onClick={() => setDismissedState(panelOpen ? state : null)}
        >
          <PanelRightOpen size={17} />
          분석 결과 {panelOpen ? '접기' : '보기'}
        </button>
      )}
      <aside
        ref={panelRef}
        id="map-analysis-panel"
        className="map-analysis-panel"
        aria-label="분석 결과 패널"
        hidden={!panelOpen}
      >
        <div className="map-results-heading">
          <h2>상권 분석 결과</h2>
          <button
            type="button"
            aria-label="분석 결과 닫기"
            onClick={() => {
              setDismissedState(state)
              panelToggle.current?.focus()
            }}
          >
            <X size={20} />
          </button>
        </div>
        {state.status === 'loading' && (
          <EmptyState
            type="loading"
            title="상권의 가능성을 살펴보고 있어요"
            message="지역과 업종의 데이터를 모아 분석하고 있습니다."
          />
        )}
        {state.status === 'error' && (
          <EmptyState
            type="error"
            title="분석을 완료하지 못했어요"
            message={state.message}
            onRetry={() => void run(state.request)}
          />
        )}
        {state.status === 'empty' && (
          <EmptyState
            title="아직 데이터가 충분하지 않아요"
            message={state.message}
          />
        )}
        {result && (
          <div className="analysis-results">
            <div className="result-heading">
              <div className="result-location">
                <span className="result-location-icon">
                  <MapPin size={19} />
                </span>
                <div>
                  <h2>
                    {result.regionName}
                    <ChevronRight size={15} />
                    <span>{result.industryName}</span>
                  </h2>
                  <p>{result.period} 기준 · 선택한 상권의 현재와 가능성을 함께 살펴보세요.</p>
                </div>
              </div>
              <div className="result-actions">
                <Button
                  variant="secondary"
                  onClick={() => onSave(result)}
                  aria-pressed={saved.some((item) => item.id === result.id)}
                >
                  <Bookmark
                    size={15}
                    fill={saved.some((item) => item.id === result.id) ? 'currentColor' : 'none'}
                  />
                  {saved.some((item) => item.id === result.id) ? '저장됨' : '분석 저장'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => downloadReport(result)}
                >
                  <ArrowDownToLine size={15} />
                  <span>보고서 다운로드</span>
                </Button>
              </div>
            </div>
            {!resultMatchesSelection && (
              <p
                className="stale-result-notice"
                role="status"
              >
                검색 조건이 변경되었어요. 아래는 이전 조건의 결과입니다. 새 조건으로 다시 분석해
                주세요.
              </p>
            )}
            {result.source === 'demo' && (
              <div className="demo-notice">
                <Badge tone="neutral">SAMPLE</Badge>
                <span>
                  화면과 기능을 확인하기 위한 예시 분석입니다. 실제 상권 데이터와 다릅니다.
                </span>
              </div>
            )}
            <ScoreCards analysis={result} />
            {result.researchForecast && <ResearchForecast data={result.researchForecast} />}
            <div className="primary-grid">
              {result.trends.length > 0 ? (
                <TrendChart trends={result.trends} />
              ) : (
                <section
                  className="panel trend-panel"
                  aria-label="상권 추이"
                >
                  <h2>상권 데이터 한눈에</h2>
                  <p className="no-data">제공된 추이 데이터가 없습니다.</p>
                </section>
              )}
              <Summary analysis={result} />
            </div>
            <div className="result-factors">
              <Factors factors={result.factors} />
            </div>
            <Competition data={result.competition} />
            <p className="analysis-footnote">
              {result.source === 'demo'
                ? '표시된 수치, 평가 및 AI 진단 문구는 모두 예시입니다.'
                : `분석 기준 ${result.period} · 분석일 ${new Date(result.analyzedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`}{' '}
              분석 결과와 함께 현장 방문 및 임대 조건을 확인해 주세요.
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
