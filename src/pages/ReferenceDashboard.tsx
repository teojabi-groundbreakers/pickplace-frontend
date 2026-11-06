import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Analysis, AnalysisRequest, DemoScenario, IndustryCategory } from '../types/analysis'
import type { MapRegion, MapViewData } from '../types/map'
import type { AnalysisState } from '../lib/useAnalysis'
import { useReferenceSearch } from '../lib/useReferenceSearch'
import { config } from '../lib/config'
import { ApiError } from '../lib/api'
import { mapReferenceCode } from '../lib/referenceCodeMapping'
import {
  locateReferenceDistrict,
  locateReferenceDong,
  ReferenceLocationError,
} from '../lib/locateReferenceDong'
import { getAdministrativeDongs, getBusinessTypes, getDistricts } from '../lib/backendReference'
import type { AdministrativeDong, BusinessType, District } from '../lib/backendReference'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { ReferenceSearch } from '../components/ReferenceSearch'
import type { LocationState, ReferenceState } from '../components/ReferenceSearch'
import './reference-dashboard.css'

const AreaMap = lazy(() =>
  import('../components/AreaMap').then((module) => ({ default: module.AreaMap })),
)
const noRegions: MapRegion[] = []
const noDistricts: District[] = []
const initialCenter: [number, number] = [37.5665, 126.978]

function errorState(error: unknown): ReferenceState<never> {
  return {
    status: 'error',
    message: error instanceof Error ? error.message : '목록을 불러오지 못했어요.',
    requestId: error instanceof ApiError ? (error.requestId ?? null) : null,
  }
}

export function ReferenceDashboard({
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
  const [districts, setDistricts] = useState<ReferenceState<District>>({ status: 'loading' })
  const [dongs, setDongs] = useState<ReferenceState<AdministrativeDong>>({ status: 'idle' })
  const [businessTypes, setBusinessTypes] = useState<ReferenceState<BusinessType>>({
    status: 'loading',
  })
  const [searchActive, setSearchActive] = useState(false)
  const [locationState, setLocationState] = useState<LocationState>({ status: 'idle' })
  const [locationAttempt, setLocationAttempt] = useState(0)
  const locationRequest = useRef<AbortController | null>(null)
  const [lastCenter, setLastCenter] = useState<[number, number]>(initialCenter)
  const [districtCode, setDistrictCode] = useState('')
  const [dongCode, setDongCode] = useState('')
  const [industryCode, setIndustryCode] = useState('')
  const [industryTouched, setIndustryTouched] = useState(false)
  const [districtAttempt, setDistrictAttempt] = useState(0)
  const [dongAttempt, setDongAttempt] = useState(0)
  const [industryAttempt, setIndustryAttempt] = useState(0)
  const [pointRegion, setPointRegion] = useState<MapRegion | null>(null)
  const [exploreRegion, setExploreRegion] = useState<MapRegion | null>(null)
  const [dismissedState, setDismissedState] = useState<AnalysisState | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getDistricts(controller.signal)
      .then(({ items }) => {
        if (!controller.signal.aborted) setDistricts({ status: 'success', items })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setDistricts(errorState(error))
      })
    return () => controller.abort()
  }, [districtAttempt])

  useEffect(() => {
    if (!districtCode) return
    const controller = new AbortController()
    getAdministrativeDongs(districtCode, controller.signal)
      .then(({ items }) => {
        if (!controller.signal.aborted) setDongs({ status: 'success', items })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setDongs(errorState(error))
      })
    return () => controller.abort()
  }, [districtCode, dongAttempt])

  useEffect(() => {
    const controller = new AbortController()
    getBusinessTypes(controller.signal)
      .then(({ items }) => {
        if (!controller.signal.aborted) {
          const supported = items.filter((item) => item.supported)
          setBusinessTypes({ status: 'success', items: supported })
          setIndustryCode((code) =>
            supported.some((item) => item.businessTypeCode === code) ? code : '',
          )
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setBusinessTypes(errorState(error))
      })
    return () => controller.abort()
  }, [industryAttempt])

  const referenceSearch = useReferenceSearch(
    districts.status === 'success' ? districts.items : noDistricts,
    searchActive,
  )

  const selectedDistrict =
    districts.status === 'success'
      ? districts.items.find((item) => item.districtCode === districtCode) || null
      : null
  const selectedDong =
    dongs.status === 'success'
      ? dongs.items.find(
          (item) => item.dongCode === dongCode && item.districtCode === districtCode,
        ) || null
      : null

  const dongListStatus = dongCode ? dongs.status : 'idle'

  useEffect(() => {
    if (!selectedDistrict || dongListStatus === 'loading') return
    const controller = new AbortController()
    const district = selectedDistrict
    locationRequest.current = controller

    async function findLocation() {
      if (controller.signal.aborted) return
      setLocationState({ status: 'loading' })
      try {
        let found
        if (dongCode) {
          const mapping = mapReferenceCode(district, selectedDong)
          if (mapping.status !== 'available') {
            setLocationState({
              status: 'empty',
              message: '선택한 지역의 위치를 확인할 수 없어요. 지도에서 직접 선택해 주세요.',
            })
            return
          }
          found = await locateReferenceDong(
            district.districtName,
            selectedDong!.dongName,
            mapping.officialCode,
            mapping.officialName,
            config.kakaoMapAppKey,
            controller.signal,
          )
        } else {
          found = await locateReferenceDistrict(
            district.districtName,
            config.kakaoMapAppKey,
            controller.signal,
          )
        }
        if (controller.signal.aborted) return
        const region: MapRegion = {
          code: found.region.code,
          name: found.region.region_3depth_name,
          fullName: `${found.region.address_name} · ${found.placeName} 주변`,
          center: found.center,
        }
        setLastCenter(found.center)
        setExploreRegion(region)
        setPointRegion(dongCode ? region : null)
        setLocationState({ status: 'success' })
      } catch (error) {
        if (controller.signal.aborted) return
        setLocationState({
          status:
            error instanceof ReferenceLocationError &&
            (error.code === 'NOT_FOUND' || error.code === 'MISMATCH')
              ? 'empty'
              : 'error',
          message: error instanceof Error ? error.message : '지역 위치를 찾지 못했어요.',
        })
      }
    }

    void Promise.resolve().then(findLocation)
    return () => controller.abort()
  }, [selectedDistrict, selectedDong, dongCode, dongListStatus, locationAttempt])

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
  const result = state.status === 'success' ? state.result : null
  const resultMatchesSelection = Boolean(
    result &&
    !districtCode &&
    (!industryTouched || result.request.industryCode === industryCode) &&
    (!pointRegion || result.request.regionCode === pointRegion.code),
  )
  const displayedResult = resultMatchesSelection ? result : null
  const selectedRegionCode = districtCode
    ? ''
    : pointRegion?.code || displayedResult?.request.regionCode || ''
  const mapData = useMemo<MapViewData>(
    () => ({
      center: exploreRegion?.center || displayedResult?.map.center || lastCenter,
      boundary: exploreRegion ? [] : displayedResult?.map.boundary || [],
      places: exploreRegion ? [] : displayedResult?.map.places || [],
      regionName:
        exploreRegion?.fullName ||
        displayedResult?.regionName ||
        pointRegion?.fullName ||
        '지도에서 지역을 살펴보세요',
      isDemo: !exploreRegion && displayedResult?.source === 'demo',
    }),
    [displayedResult, exploreRegion, lastCenter, pointRegion],
  )

  const analyzeRegion = (region: MapRegion, nextIndustryCode: string) => {
    locationRequest.current?.abort()
    setLocationState({ status: 'idle' })
    setLastCenter(region.center)
    setPointRegion(region)
    setDistrictCode('')
    setDongCode('')
    setDongs({ status: 'idle' })
    setIndustryCode(nextIndustryCode)
    setIndustryTouched(true)
    setExploreRegion(null)
    setDismissedState(null)
    void run({ regionCode: region.code, industryCode: nextIndustryCode })
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
          disabled={state.status === 'loading'}
          preserveViewport={Boolean(districtCode) && locationState.status !== 'success'}
          onUserInteraction={() => {
            if (locationState.status !== 'loading') return
            locationRequest.current?.abort()
            setLocationState({
              status: 'error',
              message: '지도 조작으로 위치 찾기를 중단했어요.',
            })
          }}
          onRegionSelect={() => {}}
          exploreRegion={exploreRegion}
          onExploreRegion={(region) => {
            setLastCenter(region.center)
            setExploreRegion(region)
            setDismissedState(state)
          }}
          onLookupStart={() => {
            locationRequest.current?.abort()
            setLocationState({ status: 'idle' })
            setDismissedState(state)
          }}
          analysis={{
            categories,
            industryCode,
            onIndustryChange: (code) => {
              setIndustryTouched(true)
              setIndustryCode(code)
            },
            onAnalyze: analyzeRegion,
          }}
        >
          <ReferenceSearch
            districts={districts}
            dongs={dongs}
            businessTypes={businessTypes}
            districtCode={districtCode}
            dongCode={dongCode}
            businessTypeCode={industryCode}
            pointRegion={pointRegion}
            locationState={locationState}
            onRetryLocation={() => {
              if (dongCode && dongs.status === 'error') {
                setDongs({ status: 'loading' })
                setDongAttempt((value) => value + 1)
              }
              setLocationAttempt((value) => value + 1)
            }}
            pending={state.status === 'loading'}
            onAnalyze={analyzeRegion}
            searchDongs={referenceSearch.items}
            searchStatus={referenceSearch.status}
            searchFailedCount={referenceSearch.failedCount}
            onRetrySearch={referenceSearch.retry}
            onSearchActiveChange={setSearchActive}
            onDistrictChange={(code) => {
              if (code === districtCode && !dongCode) return
              locationRequest.current?.abort()
              setLocationState({ status: code ? 'loading' : 'idle' })
              setDistrictCode(code)
              setPointRegion(null)
              setExploreRegion(null)
              setDongCode('')
              if (code !== districtCode) setDongs({ status: code ? 'loading' : 'idle' })
            }}
            onDongChange={(code) => {
              if (code === dongCode) return
              locationRequest.current?.abort()
              setLocationState({ status: districtCode ? 'loading' : 'idle' })
              setPointRegion(null)
              setExploreRegion(null)
              setDongCode(code)
            }}
            onBusinessTypeChange={(code) => {
              setIndustryTouched(true)
              setIndustryCode(code)
            }}
            onRetryDistricts={() => {
              setDistricts({ status: 'loading' })
              setDistrictAttempt((value) => value + 1)
            }}
            onRetryDongs={() => {
              setDongs({ status: 'loading' })
              setDongAttempt((value) => value + 1)
            }}
            onRetryBusinessTypes={() => {
              setBusinessTypes({ status: 'loading' })
              setIndustryAttempt((value) => value + 1)
            }}
          />
        </AreaMap>
      </Suspense>
      <AnalysisPanel
        state={state}
        run={run}
        saved={saved}
        onSave={onSave}
        resultMatchesSelection={resultMatchesSelection}
        dismissedState={dismissedState}
        setDismissedState={setDismissedState}
      />
    </>
  )
}
