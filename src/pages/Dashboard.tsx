import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowDownToLine, Bookmark, ChevronRight, MapPin, PanelRightOpen, X } from 'lucide-react'
import type { Analysis, AnalysisRequest, Catalog, DemoScenario } from '../types/analysis'
import type { MapRegion, MapViewData } from '../types/map'
import type { SearchSelection } from '../lib/selection'
import type { AnalysisState } from '../lib/useAnalysis'
import { selectionFromRequest } from '../lib/selection'
import { config } from '../lib/config'
import { defaultRequest } from '../data/demo'
import { downloadReport } from '../lib/reports'
import { MapSearch } from '../components/MapSearch'
import { catalogRegions } from '../lib/catalogRegions'
import { ScoreCards } from '../components/ScoreCards'
import { TrendChart } from '../components/TrendChart'
import { Factors, Summary, Competition } from '../components/Insights'
import { Badge, Button, EmptyState } from '../components/ui'

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
  const panelOpen = state.status !== 'idle' && dismissedState !== state
  const panelToggle = useRef<HTMLButtonElement>(null)
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
            <div className="primary-grid">
              <TrendChart trends={result.trends} />
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
