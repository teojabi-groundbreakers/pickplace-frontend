import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Analysis, AnalysisRequest, Catalog, DemoScenario } from '../types/analysis'
import type { MapRegion, MapViewData } from '../types/map'
import type { SearchSelection } from '../lib/selection'
import type { AnalysisState } from '../lib/useAnalysis'
import { selectionFromRequest } from '../lib/selection'
import { config } from '../lib/config'
import { defaultRequest } from '../data/demo'
import { MapSearch } from '../components/MapSearch'
import { catalogRegions } from '../lib/catalogRegions'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { EmptyState } from '../components/ui'

const AreaMap = lazy(() =>
  import('../components/AreaMap').then((module) => ({ default: module.AreaMap })),
)

export function Dashboard({
  catalog,
  catalogError,
  retryCatalog,
  state,
  run,
  saved,
  onSave,
}: {
  catalog: Catalog | null
  catalogError: string
  retryCatalog: () => void
  state: AnalysisState
  run: (request: AnalysisRequest, scenario?: DemoScenario) => Promise<void>
  saved: Analysis[]
  onSave: (analysis: Analysis) => void
}) {
  const [searchParams] = useSearchParams()
  const [draft, setDraft] = useState<SearchSelection | null>(null)
  const [pointRegion, setPointRegion] = useState<MapRegion | null>(null)
  const [exploreRegion, setExploreRegion] = useState<MapRegion | null>(null)
  const scenario = searchParams.get('scenario')
  const [dismissedState, setDismissedState] = useState<AnalysisState | null>(null)
  const allRegions = useMemo(() => catalogRegions(catalog), [catalog])

  useEffect(() => {
    if (config.demoMode && (scenario === 'success' || scenario === 'empty' || scenario === 'error'))
      void run(defaultRequest, scenario)
  }, [scenario, run])

  const result = state.status === 'success' ? state.result : null
  const initial =
    result?.request ||
    (state.status !== 'idle' && state.status !== 'success' ? state.request : defaultRequest)
  const selection = useMemo(
    () =>
      draft ||
      (catalog
        ? selectionFromRequest(catalog, {
            regionCode: initial.regionCode,
            industryCode: initial.industryCode,
          })
        : { cityCode: '', districtCode: '', regionCode: '', categoryCode: '', industryCode: '' }),
    [draft, catalog, initial.regionCode, initial.industryCode],
  )
  const regions = useMemo<MapRegion[]>(
    () =>
      catalog?.cities
        .filter((city) => !selection.cityCode || city.code === selection.cityCode)
        .flatMap((city) =>
          city.districts
            .filter(
              (district) => !selection.districtCode || district.code === selection.districtCode,
            )
            .flatMap((district) =>
              district.neighborhoods.map((region) => ({
                ...region,
                fullName: `${district.name} ${region.name}`,
              })),
            ),
        ) || [],
    [catalog, selection.cityCode, selection.districtCode],
  )
  const resolvedRegion = useMemo<MapRegion | null>(() => {
    if (pointRegion?.code === selection.regionCode) return pointRegion
    if (
      result?.request.regionCode === selection.regionCode &&
      /^\d{10}$/.test(selection.regionCode)
    ) {
      return {
        code: result.request.regionCode,
        name: result.regionName,
        fullName: result.regionName,
        center: result.map.center,
      }
    }
    return null
  }, [pointRegion, result, selection.regionCode])
  const selectedRegion =
    resolvedRegion || regions.find((region) => region.code === selection.regionCode)
  const city = catalog?.cities.find((item) => item.code === selection.cityCode)
  const district = city?.districts.find((item) => item.code === selection.districtCode)
  const resultMatchesSelection =
    result &&
    result.request.regionCode === selection.regionCode &&
    result.request.industryCode === selection.industryCode
  const displayedResult = resultMatchesSelection ? result : null
  const mapData = useMemo<MapViewData>(
    () => ({
      center: exploreRegion?.center ||
        displayedResult?.map.center ||
        selectedRegion?.center ||
        regions[0]?.center || [37.5665, 126.978],
      boundary: exploreRegion ? [] : displayedResult?.map.boundary || [],
      places: exploreRegion ? [] : displayedResult?.map.places || [],
      regionName:
        exploreRegion?.fullName ||
        selectedRegion?.fullName ||
        district?.name ||
        city?.name ||
        '분석할 지역을 선택하세요',
      isDemo: !exploreRegion && displayedResult?.source === 'demo',
    }),
    [displayedResult, selectedRegion, regions, district, city, exploreRegion],
  )
  const pending = state.status === 'loading'
  const beginLookup = useCallback(() => setDismissedState(state), [state])

  const selectRegion = useCallback(
    (code: string) => {
      if (!catalog || pending) return
      setPointRegion(null)
      setExploreRegion(null)
      const next = selectionFromRequest(catalog, {
        regionCode: code,
        industryCode: selection.industryCode,
      })
      setDraft({
        ...selection,
        cityCode: next.cityCode,
        districtCode: next.districtCode,
        regionCode: next.regionCode,
      })
    },
    [catalog, pending, selection],
  )

  const changeSelection = (next: SearchSelection) => {
    setDraft(next)
    setPointRegion((current) => (current?.code === next.regionCode ? current : null))
    if (
      next.regionCode !== selection.regionCode ||
      next.districtCode !== selection.districtCode ||
      next.cityCode !== selection.cityCode
    ) {
      setExploreRegion(null)
    }
  }

  const submitAnalysis = (request: AnalysisRequest) => {
    if (pending) return
    setExploreRegion(null)
    setDismissedState(null)
    void run(request)
  }

  const analyzeRegion = (region: MapRegion, industryCode: string) => {
    if (!catalog || pending) return
    const request = { regionCode: region.code, industryCode }
    setPointRegion(region)
    setDraft(selectionFromRequest(catalog, request))
    submitAnalysis(request)
  }

  return (
    <>
      <h1 className="sr-only">지도에서 상권 탐색</h1>
      <Suspense
        fallback={
          <div
            className="map-workspace-loading"
            role="status"
          >
            지역 탐색 지도를 불러오고 있어요…
          </div>
        }
      >
        <AreaMap
          data={mapData}
          regions={regions}
          analysis={{
            categories: catalog?.categories || [],
            industryCode: selection.industryCode,
            onIndustryChange: (industryCode) => {
              const category = catalog?.categories.find((item) =>
                item.industries.some((industry) => industry.code === industryCode),
              )
              changeSelection({ ...selection, industryCode, categoryCode: category?.code || '' })
            },
            onAnalyze: analyzeRegion,
          }}
          exploreRegion={exploreRegion}
          onExploreRegion={(region) => {
            setExploreRegion(region)
            setDismissedState(state)
          }}
          selectedRegionCode={selection.regionCode}
          disabled={pending}
          onRegionSelect={selectRegion}
          onLookupStart={beginLookup}
        >
          {catalog ? (
            <MapSearch
              catalog={catalog}
              regions={allRegions}
              selection={selection}
              initial={initial}
              onChange={changeSelection}
              onRegionSelect={selectRegion}
              pending={pending}
              onSubmit={submitAnalysis}
              resolvedRegion={resolvedRegion}
            />
          ) : (
            <div className="map-search-overlay">
              <EmptyState
                type={catalogError ? 'error' : 'loading'}
                title={
                  catalogError ? '검색 목록을 불러오지 못했어요' : '지역과 업종을 불러오고 있어요'
                }
                message={catalogError || '잠시만 기다려 주세요.'}
                onRetry={catalogError ? retryCatalog : undefined}
              />
            </div>
          )}
        </AreaMap>
      </Suspense>
      <AnalysisPanel
        state={state}
        run={run}
        saved={saved}
        onSave={onSave}
        resultMatchesSelection={Boolean(resultMatchesSelection)}
        dismissedState={dismissedState}
        setDismissedState={setDismissedState}
      />
    </>
  )
}
