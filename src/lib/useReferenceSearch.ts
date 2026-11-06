import { useCallback, useEffect, useRef, useState } from 'react'
import { getAdministrativeDongs } from './backendReference'
import type { AdministrativeDong, District } from './backendReference'

export type ReferenceSearchItem = {
  district: District
  dong: AdministrativeDong
}

type SearchStatus = 'idle' | 'loading' | 'success' | 'partial' | 'error'

type Progress = {
  key: string
  status: SearchStatus
  failedCount: number
  items: ReferenceSearchItem[]
}

const MAX_CONCURRENT_REQUESTS = 4

/** Builds a search index from the BE's district-scoped lists without inferring coordinates. */
export function useReferenceSearch(districts: District[], active: boolean) {
  const cache = useRef(new Map<string, AdministrativeDong[]>())
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState<Progress>({
    key: '',
    status: 'idle',
    failedCount: 0,
    items: [],
  })
  const key = JSON.stringify(districts)

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const currentDistricts = JSON.parse(key) as District[]
    const pending = currentDistricts.filter((district) => !cache.current.has(district.districtCode))
    let next = 0
    let failures = 0

    function cachedItems() {
      return currentDistricts.flatMap((district) =>
        (cache.current.get(district.districtCode) || []).map((dong) => ({ district, dong })),
      )
    }

    async function run() {
      if (controller.signal.aborted) return
      setProgress({ key, status: 'loading', failedCount: 0, items: cachedItems() })

      async function worker() {
        while (!controller.signal.aborted && next < pending.length) {
          const district = pending[next++]
          try {
            const { items } = await getAdministrativeDongs(district.districtCode, controller.signal)
            if (controller.signal.aborted) return
            cache.current.set(district.districtCode, items)
          } catch {
            if (controller.signal.aborted) return
            failures += 1
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, pending.length) }, () => worker()),
      )
      if (controller.signal.aborted) return
      const completed = currentDistricts.length - failures
      setProgress({
        key,
        status: failures === 0 ? 'success' : completed > 0 ? 'partial' : 'error',
        failedCount: failures,
        items: cachedItems(),
      })
    }

    void Promise.resolve().then(run)
    return () => controller.abort()
  }, [active, key, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const status = !active ? 'idle' : progress.key === key ? progress.status : 'loading'
  const items = progress.key === key ? progress.items : []

  return {
    items,
    status,
    failedCount: active && progress.key === key ? progress.failedCount : 0,
    retry,
  }
}
