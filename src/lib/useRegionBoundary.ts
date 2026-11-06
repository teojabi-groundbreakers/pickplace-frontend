import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RegionBoundary } from '../types/boundary'
import { getRegionBoundary, isAdministrativeRegionCode } from './regionBoundary'

export type RegionBoundaryState =
  | { status: 'idle' | 'loading' | 'empty'; regionCode: string }
  | { status: 'success'; regionCode: string; boundary: RegionBoundary }
  | { status: 'error'; regionCode: string; message: string }

export function useRegionBoundary(regionCode: string) {
  const [attempt, setAttempt] = useState(0)
  const request = useMemo(() => ({ regionCode, attempt }), [regionCode, attempt])
  const [completion, setCompletion] = useState<{
    request: typeof request
    state: RegionBoundaryState
  } | null>(null)

  useEffect(() => {
    const code = request.regionCode
    if (!isAdministrativeRegionCode(code)) return

    const controller = new AbortController()

    getRegionBoundary(code, controller.signal)
      .then((boundary) => {
        if (controller.signal.aborted) return

        setCompletion({
          request,
          state: boundary
            ? { status: 'success', regionCode: code, boundary }
            : { status: 'empty', regionCode: code },
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return

        setCompletion({
          request,
          state: {
            status: 'error',
            regionCode: code,
            message: error instanceof Error ? error.message : '행정동 경계를 불러오지 못했어요.',
          },
        })
      })

    return () => controller.abort()
  }, [request])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const state: RegionBoundaryState = !isAdministrativeRegionCode(regionCode)
    ? { status: 'idle', regionCode }
    : completion?.request === request
      ? completion.state
      : { status: 'loading', regionCode }

  return { state, retry }
}
