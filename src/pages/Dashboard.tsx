import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowDownToLine, Bookmark, ChevronRight, MapPin } from 'lucide-react'
import type { Analysis, AnalysisRequest, Catalog, DemoScenario } from '../types/analysis'
import type { MapRegion, MapViewData } from '../types/map'
import type { SearchSelection } from '../lib/selection'
import type { AnalysisState } from '../lib/useAnalysis'
import { selectionFromRequest } from '../lib/selection'
import { config } from '../lib/config'
import { defaultRequest } from '../data/demo'
import { downloadReport } from '../lib/reports'
import { SearchForm } from '../components/SearchForm'
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
  const scenario = searchParams.get('scenario')

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
  const selectedRegion = regions.find((region) => region.code === selection.regionCode)
  const city = catalog?.cities.find((item) => item.code === selection.cityCode)
  const district = city?.districts.find((item) => item.code === selection.districtCode)
  const resultMatchesSelection =
    result &&
    result.request.regionCode === selection.regionCode &&
    result.request.industryCode === selection.industryCode
  const displayedResult = resultMatchesSelection ? result : null
  const mapData = useMemo<MapViewData>(
    () => ({
      center: displayedResult?.map.center ||
        selectedRegion?.center ||
        regions[0]?.center || [37.5665, 126.978],
      boundary: displayedResult?.map.boundary || [],
      places: displayedResult?.map.places || [],
      regionName:
        selectedRegion?.fullName || district?.name || city?.name || '분석할 지역을 선택하세요',
      isDemo: displayedResult?.source === 'demo',
    }),
    [displayedResult, selectedRegion, regions, district, city],
  )
  const pending = state.status === 'loading'

  const selectRegion = useCallback(
    (code: string) => {
      if (!catalog || pending) return
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

  return (
    <>
      <div className="page-heading map-page-heading">
        <div>
          <span className="eyebrow">YOUR NEXT START, ON THE MAP</span>
          <h1>
            좋은 시작은, 좋은 자리에서<span className="title-period">.</span>
          </h1>
          <p>먼저 지도를 둘러보고, 궁금한 지역과 업종을 분석해 보세요.</p>
        </div>
        <span className="map-flow-caption">
          지역 탐색 <ChevronRight size={12} />
          조건 선택 <ChevronRight size={12} />
          상권 분석
        </span>
      </div>
      <Suspense
        fallback={
          <div
            className="panel map-placeholder map-first-placeholder"
            role="status"
          >
            지역 탐색 지도를 불러오고 있어요…
          </div>
        }
      >
        <AreaMap
          data={mapData}
          regions={regions}
          selectedRegionCode={selection.regionCode}
          disabled={pending}
          onRegionSelect={selectRegion}
        />
      </Suspense>
      {catalog ? (
        <SearchForm
          catalog={catalog}
          initial={initial}
          value={selection}
          onChange={setDraft}
          pending={pending}
          onSubmit={(request) => void run(request)}
        />
      ) : (
        <EmptyState
          type={catalogError ? 'error' : 'loading'}
          title={
            catalogError ? '검색 목록을 불러오지 못했어요' : '분석할 지역과 업종을 불러오고 있어요'
          }
          message={catalogError || '잠시만 기다려 주세요.'}
          onRetry={catalogError ? retryCatalog : undefined}
        />
      )}
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
          message="신뢰할 수 있는 분석을 위해 더 많은 데이터가 필요합니다. 다른 행정동이나 업종을 선택해 보세요."
        />
      )}
      {state.status === 'idle' && catalog && (
        <div className="analysis-start-hint">
          <span className="step-chip">03</span>
          <p>
            지역과 업종을 선택한 뒤 <strong>상권 분석하기</strong>를 눌러 주세요. 점수와 인사이트가
            여기에 표시됩니다.
          </p>
        </div>
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
              <span>화면과 기능을 확인하기 위한 예시 분석입니다. 실제 상권 데이터와 다릅니다.</span>
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
    </>
  )
}
