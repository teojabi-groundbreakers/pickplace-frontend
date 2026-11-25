import { useEffect, useRef, useState } from 'react'
import { getLocalResearchForecast, type LocalResearchResult } from '../lib/localResearchForecast'
import type { AnalysisRequest } from '../types/analysis'
import { ResearchForecast } from './ResearchForecast'
import { Badge, Button } from './ui'

type ResearchState = { status: 'idle' | 'loading' | 'error' } | LocalResearchResult

export function LocalResearchForecast({ selection }: { selection: AnalysisRequest }) {
  const [state, setState] = useState<ResearchState>({ status: 'idle' })
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  async function loadForecast() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setState({ status: 'loading' })

    try {
      const result = await getLocalResearchForecast(selection, controller.signal)
      if (!controller.signal.aborted) setState(result)
    } catch {
      if (!controller.signal.aborted) setState({ status: 'error' })
    } finally {
      request.current = null
    }
  }

  if (state.status === 'available') {
    return (
      <ResearchForecast
        data={state.forecast}
        scopeLabel={state.scopeLabel}
      />
    )
  }

  return (
    <section
      className="panel research-forecast"
      aria-label="연구용 매출 성장률 추정"
    >
      <div className="panel-header">
        <h2>분기별 매출 성장률 추정</h2>
        <Badge tone="neutral">연구용</Badge>
      </div>
      <div className="research-forecast-body">
        <p className="research-forecast-note">
          서울 원천의 세부 업종 기준으로 2026년 4분기 매출을 추정합니다.
        </p>
        {state.status === 'unavailable' && (
          <p
            className="research-forecast-unavailable"
            role="status"
          >
            선택한 지역과 업종의 대응이나 예측에 필요한 매출 이력을 확인할 수 없어요.
          </p>
        )}
        {state.status === 'error' && (
          <p
            className="research-forecast-unavailable"
            role="alert"
          >
            연구 결과를 불러오지 못했어요. 다시 시도해 주세요.
          </p>
        )}
        {state.status !== 'unavailable' && (
          <Button
            variant="secondary"
            className="research-forecast-action"
            disabled={state.status === 'loading'}
            onClick={() => void loadForecast()}
          >
            {state.status === 'loading'
              ? '연구용 추정 중…'
              : state.status === 'error'
                ? '연구용 추정 다시 시도'
                : '연구용 추정 보기'}
          </Button>
        )}
      </div>
    </section>
  )
}
