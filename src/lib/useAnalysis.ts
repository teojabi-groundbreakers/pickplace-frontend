import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analysis, AnalysisRequest, DemoScenario } from '../types/analysis'
import { analyze, ApiError } from './api'

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading'; request: AnalysisRequest }
  | { status: 'success'; result: Analysis }
  | { status: 'error' | 'empty'; request: AnalysisRequest; message: string }

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const run = useCallback(async (request: AnalysisRequest, scenario?: DemoScenario) => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setState({ status: 'loading', request })
    try {
      const result = await analyze(request, next.signal, scenario)
      if (!next.signal.aborted) setState({ status: 'success', result })
    } catch (error) {
      if (next.signal.aborted) return
      setState({
        status: error instanceof ApiError && error.code === 'INSUFFICIENT_DATA' ? 'empty' : 'error',
        request,
        message: error instanceof Error ? error.message : '분석 중 문제가 발생했습니다.',
      })
    }
  }, [])
  const open = (result: Analysis) => {
    controller.current?.abort()
    setState({ status: 'success', result })
  }
  return { state, run, open }
}
