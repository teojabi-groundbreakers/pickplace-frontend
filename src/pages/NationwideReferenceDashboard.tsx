import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Analysis, AnalysisRequest, DemoScenario, IndustryCategory } from '../types/analysis'
import type { MapRegion, MapViewData } from '../types/map'
import type { AnalysisState } from '../lib/useAnalysis'
import type { BusinessType, District } from '../lib/backendReference'
import { getBusinessTypes } from '../lib/backendReference'
import { ApiError } from '../lib/api'
import { config } from '../lib/config'
import {
  locateNationwideReferenceDong,
  locateNationwideReferenceGroup,
  ReferenceLocationError,
} from '../lib/locateReferenceDong'
import { useNationwideRegions } from '../lib/useNationwideRegions'
import type { RegionItem } from '../lib/nationwideRegions'
import type { ReferenceProvince } from '../lib/referenceAreas'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { ReferenceSearch } from '../components/ReferenceSearch'
import type {
  LocationState,
  ReferenceDongOption,
  ReferenceState,
} from '../components/ReferenceSearch'
import './reference-dashboard.css'

const AreaMap = lazy(() =>
  import('../components/AreaMap').then((module) => ({ default: module.AreaMap })),
)
const noRegions: MapRegion[] = []
const initialCenter: [number, number] = [37.5665, 126.978]
const idleAnalysis: AnalysisState = { status: 'idle' }
const unavailableMessage = '선택한 지역의 상권 분석은 아직 준비되지 않았어요.'

type RegionListState = ReturnType<typeof useNationwideRegions>['provinces']

function mapList<T>(state: RegionListState, map: (item: RegionItem) => T): ReferenceState<T> {
  if (state.status === 'success') return { status: 'success', items: state.items.map(map) }
  if (state.status === 'error') {
    return { status: 'error', message: state.message, requestId: state.requestId }
  }
  return state.status === 'loading' ? { status: 'loading' } : { status: 'idle' }
}

function selectedItem(state: RegionListState, code: string): RegionItem | null {
  return state.status === 'success'
    ? state.items.find((item) => item.regionCode === code) || null
    : null
}

type LocatedState = {
  revision: number
  scope: 'group' | 'locality'
  status: LocationState
  region: MapRegion | null
}

export function NationwideReferenceDashboard({
  state,
  run,
  saved,
  onSave,
}: {
  state: AnalysisState
  run: (request: AnalysisRequest, scenario?: DemoScenario) => Promise<void>
  saved: Analysis[]
  onSave: (analysis: Analysis) => void
}) {
  const regions = useNationwideRegions()
  const [businessTypes, setBusinessTypes] = useState<ReferenceState<BusinessType>>({
    status: 'loading',
  })
  const [industryCode, setIndustryCode] = useState('')
  const [industryAttempt, setIndustryAttempt] = useState(0)
  const [locationAttempt, setLocationAttempt] = useState(0)
  const [located, setLocated] = useState<LocatedState | null>(null)
  const [explored, setExplored] = useState<{ revision: number; region: MapRegion } | null>(null)
  const [dismissedState, setDismissedState] = useState<AnalysisState | null>(null)
  const locationRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getBusinessTypes(controller.signal)
      .then(({ items }) => {
        if (controller.signal.aborted) return
        const supported = items.filter((item) => item.supported)
        setBusinessTypes({ status: 'success', items: supported })
        setIndustryCode((code) =>
          supported.some((item) => item.businessTypeCode === code) ? code : '',
        )
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setBusinessTypes({
          status: 'error',
          message: error instanceof Error ? error.message : '업종 목록을 불러오지 못했어요.',
          requestId: error instanceof ApiError ? (error.requestId ?? null) : null,
        })
      })
    return () => controller.abort()
  }, [industryAttempt])

  const province = selectedItem(regions.provinces, regions.provinceCode)
  const group = selectedItem(regions.groups, regions.groupCode)
  const locality = selectedItem(regions.localities, regions.localityCode)
  const revision = regions.selectionRevision
  const provinceName = province?.regionName || ''
  const groupName = group?.regionName || ''
  const localityName = locality?.regionName || ''
  const localityCode = locality?.regionCode || ''
  const groupLocalities = JSON.stringify(
    regions.localities.status === 'success'
      ? regions.localities.items.map((item) => item.regionCode)
      : [],
  )
  const hasGroupLocalities =
    regions.localities.status === 'success' && regions.localities.items.length > 0
  const locationScope = localityCode ? 'locality' : 'group'

  useEffect(() => {
    if (!provinceName || !groupName) return
    if (!localityCode && !hasGroupLocalities) return
    if (localityCode && !localityName) return
    const controller = new AbortController()
    locationRequest.current = controller
    const request = localityCode
      ? locateNationwideReferenceDong(
          provinceName,
          groupName,
          localityName,
          localityCode,
          config.kakaoMapAppKey,
          controller.signal,
        )
      : locateNationwideReferenceGroup(
          provinceName,
          groupName,
          JSON.parse(groupLocalities) as string[],
          config.kakaoMapAppKey,
          controller.signal,
        )
    request
      .then((found) => {
        if (controller.signal.aborted) return
        setLocated({
          revision,
          scope: locationScope,
          status: { status: 'success' },
          region: {
            code: found.region.code,
            name: found.region.region_3depth_name,
            fullName: `${found.region.address_name} · ${found.placeName} 주변`,
            center: found.center,
          },
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLocated({
          revision,
          scope: locationScope,
          region: null,
          status: {
            status:
              error instanceof ReferenceLocationError &&
              (error.code === 'NOT_FOUND' || error.code === 'MISMATCH')
                ? 'empty'
                : 'error',
            message: error instanceof Error ? error.message : '지역 위치를 찾지 못했어요.',
          },
        })
      })
    return () => controller.abort()
  }, [
    provinceName,
    groupName,
    localityName,
    localityCode,
    hasGroupLocalities,
    groupLocalities,
    locationScope,
    revision,
    locationAttempt,
  ])

  const selectedLocation = located?.revision === revision ? located : null
  const locationState: LocationState = selectedLocation?.status || {
    status: localityCode || (groupName && hasGroupLocalities) ? 'loading' : 'idle',
  }
  const pointRegion = selectedLocation?.scope === 'locality' ? selectedLocation.region : null
  const exploreRegion =
    explored?.revision === revision ? explored.region : selectedLocation?.region || null
  // The nationwide flow covers region selection. Only reopened results are displayed.
  const visibleState = revision === 0 && state.status === 'success' ? state : idleAnalysis
  const result = visibleState.status === 'success' ? visibleState.result : null
  const selectedRegionCode = pointRegion?.code || result?.request.regionCode || ''
  const mapData = useMemo<MapViewData>(
    () => ({
      center: exploreRegion?.center || result?.map.center || initialCenter,
      boundary: exploreRegion ? [] : result?.map.boundary || [],
      places: exploreRegion ? [] : result?.map.places || [],
      regionName: exploreRegion?.fullName || result?.regionName || '지도에서 지역을 살펴보세요',
      isDemo: !exploreRegion && result?.source === 'demo',
    }),
    [exploreRegion, result],
  )
  const categories = useMemo<IndustryCategory[]>(() => {
    if (businessTypes.status !== 'success') return []
    return [
      {
        code: 'supported',
        name: '지원 업종',
        industries: businessTypes.items.map((item) => ({
          code: item.businessTypeCode,
          name: item.businessTypeName,
        })),
      },
    ]
  }, [businessTypes])

  const provinces = mapList<ReferenceProvince>(regions.provinces, (item) => ({
    code: item.regionCode,
    name: item.regionName,
  }))
  const districts = mapList<District>(regions.groups, (item) => ({
    districtCode: item.regionCode,
    districtName: item.regionName,
  }))
  const dongs = mapList<ReferenceDongOption>(regions.localities, (item) => ({
    dongCode: item.regionCode,
    dongName: item.regionName,
    officialCodeStatus: 'CURRENT',
  }))

  function cancelLocation() {
    locationRequest.current?.abort()
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
          regions={noRegions}
          selectedRegionCode={selectedRegionCode}
          lookupRevision={revision}
          disabled={false}
          preserveViewport={Boolean(regions.groupCode) && !exploreRegion}
          onUserInteraction={() => {
            if (locationState.status !== 'loading') return
            cancelLocation()
            setLocated({
              revision,
              scope: locationScope,
              region: null,
              status: { status: 'error', message: '지도 조작으로 위치 찾기를 중단했어요.' },
            })
          }}
          onRegionSelect={() => {}}
          exploreRegion={exploreRegion}
          onExploreRegion={(region) => {
            setExplored({ revision, region })
            setDismissedState(visibleState)
          }}
          onLookupStart={() => {
            if (locationState.status === 'loading') {
              cancelLocation()
              setLocated({
                revision,
                scope: locationScope,
                status: { status: 'idle' },
                region: selectedLocation?.region || null,
              })
            }
            setDismissedState(visibleState)
          }}
          analysisUnavailableMessage={unavailableMessage}
          analysis={{
            categories,
            industryCode,
            onIndustryChange: setIndustryCode,
            onAnalyze: () => {},
          }}
        >
          <ReferenceSearch
            provinces={provinces.status === 'success' ? provinces.items : []}
            provinceState={provinces}
            onRetryProvinces={regions.retryProvinces}
            nationwide
            analysisUnavailableMessage={unavailableMessage}
            regionNotice={regions.notice}
            districts={districts}
            dongs={dongs}
            businessTypes={businessTypes}
            provinceCode={regions.provinceCode}
            districtCode={regions.groupCode}
            dongCode={regions.localityCode}
            businessTypeCode={industryCode}
            pointRegion={pointRegion}
            locationState={locationState}
            onRetryLocation={() => {
              setLocated({
                revision,
                scope: locationScope,
                status: { status: 'loading' },
                region: null,
              })
              setLocationAttempt((attempt) => attempt + 1)
            }}
            pending={false}
            onAnalyze={() => {}}
            onProvinceChange={(code) => {
              if (code === regions.provinceCode) return
              cancelLocation()
              regions.selectProvince(code)
            }}
            onDistrictChange={(code) => {
              if (code === regions.groupCode && !regions.localityCode) return
              cancelLocation()
              regions.selectGroup(code)
            }}
            onDongChange={(code) => {
              if (code === regions.localityCode) return
              cancelLocation()
              regions.selectLocality(code)
            }}
            onBusinessTypeChange={setIndustryCode}
            onRetryDistricts={regions.retryGroups}
            onRetryDongs={regions.retryLocalities}
            onRetryBusinessTypes={() => {
              setBusinessTypes({ status: 'loading' })
              setIndustryAttempt((attempt) => attempt + 1)
            }}
          />
        </AreaMap>
      </Suspense>
      <AnalysisPanel
        state={visibleState}
        run={run}
        saved={saved}
        onSave={onSave}
        resultMatchesSelection={Boolean(result)}
        dismissedState={dismissedState}
        setDismissedState={setDismissedState}
      />
    </>
  )
}
