import { useId, useMemo, useState } from 'react'
import { ChevronDown, Coffee, LoaderCircle, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import type { AdministrativeDong, BusinessType, District } from '../lib/backendReference'
import type { MapRegion } from '../types/map'
import type { ReferenceProvince } from '../lib/referenceAreas'
import { Button } from './ui'

export type ReferenceState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; items: T[] }
  | { status: 'error'; message: string; requestId: string | null }

const noDistricts: District[] = []
const noDongs: AdministrativeDong[] = []

export type LocationState = {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error'
  message?: string
}

type SearchStatus = 'idle' | 'loading' | 'success' | 'partial' | 'error'
type SearchDong = { district: District; dong: AdministrativeDong }
type SearchMatch =
  | { type: 'district'; district: District }
  | { type: 'dong'; district: District; dong: AdministrativeDong }

type Props = {
  provinces: ReferenceProvince[]
  districts: ReferenceState<District>
  dongs: ReferenceState<AdministrativeDong>
  businessTypes: ReferenceState<BusinessType>
  provinceCode: string
  districtCode: string
  dongCode: string
  businessTypeCode: string
  pointRegion?: MapRegion | null
  locationState: LocationState
  onRetryLocation: () => void
  pending: boolean
  searchDongs?: SearchDong[]
  searchStatus?: SearchStatus
  searchFailedCount?: number
  onSearchActiveChange?: (active: boolean) => void
  onRetrySearch?: () => void
  onProvinceChange: (code: string) => void
  onDistrictChange: (code: string) => void
  onDongChange: (code: string) => void
  onBusinessTypeChange: (code: string) => void
  onAnalyze: (region: MapRegion, code: string) => void
  onRetryDistricts: () => void
  onRetryDongs: () => void
  onRetryBusinessTypes: () => void
}

function Feedback<T>({
  state,
  loading,
  empty,
  retryLabel,
  onRetry,
}: {
  state: ReferenceState<T>
  loading: string
  empty: string
  retryLabel: string
  onRetry: () => void
}) {
  if (state.status === 'loading') return <p role="status">{loading}</p>
  if (state.status === 'success' && state.items.length === 0) return <p role="status">{empty}</p>
  if (state.status !== 'error') return null

  return (
    <div role="alert">
      <p>{state.message}</p>
      {state.requestId && <p>요청 ID: {state.requestId}</p>}
      <button
        type="button"
        onClick={onRetry}
      >
        {retryLabel}
      </button>
    </div>
  )
}

export function ReferenceSearch({
  provinces,
  districts,
  dongs,
  businessTypes,
  provinceCode,
  districtCode,
  dongCode,
  businessTypeCode,
  pointRegion,
  locationState,
  onRetryLocation,
  pending,
  searchDongs,
  searchStatus = 'idle',
  searchFailedCount = 0,
  onSearchActiveChange,
  onRetrySearch,
  onProvinceChange,
  onDistrictChange,
  onDongChange,
  onBusinessTypeChange,
  onAnalyze,
  onRetryDistricts,
  onRetryDongs,
  onRetryBusinessTypes,
}: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const districtItems = districts.status === 'success' ? districts.items : noDistricts
  const dongItems = dongs.status === 'success' ? dongs.items : noDongs
  const industryItems = businessTypes.status === 'success' ? businessTypes.items : []
  const selectedDistrict = districtItems.find((item) => item.districtCode === districtCode)
  const selectedDong =
    dongItems.find((item) => item.dongCode === dongCode) ||
    searchDongs?.find(
      (item) => item.district.districtCode === districtCode && item.dong.dongCode === dongCode,
    )?.dong
  const selectedIndustry = industryItems.find((item) => item.businessTypeCode === businessTypeCode)
  const selectedName = selectedDong?.dongName || selectedDistrict?.districtName || pointRegion?.name

  const matches = useMemo(() => {
    const normalized = query.replace(/\s/g, '').toLocaleLowerCase('ko-KR')
    if (!normalized) return []
    const districtMatches: SearchMatch[] = districtItems
      .filter((item) =>
        item.districtName.replace(/\s/g, '').toLocaleLowerCase('ko-KR').includes(normalized),
      )
      .map((district) => ({ type: 'district', district }))
    const candidates =
      searchDongs ||
      (selectedDistrict ? dongItems.map((dong) => ({ district: selectedDistrict, dong })) : [])
    const dongMatches: SearchMatch[] = candidates
      .filter(({ district, dong }) =>
        `${district.districtName} ${dong.dongName}`
          .replace(/\s/g, '')
          .toLocaleLowerCase('ko-KR')
          .includes(normalized),
      )
      .map(({ district, dong }) => ({ type: 'dong', district, dong }))
    return [...districtMatches, ...dongMatches].slice(0, 8)
  }, [query, districtItems, searchDongs, selectedDistrict, dongItems])

  const searching = focused && query.trim().length > 0
  const choose = (match: SearchMatch) => {
    if (match.type === 'district') {
      onDistrictChange(match.district.districtCode)
    } else {
      if (match.district.districtCode !== districtCode)
        onDistrictChange(match.district.districtCode)
      onDongChange(match.dong.dongCode)
    }
    setQuery('')
    setFocused(false)
    setActiveIndex(-1)
    setError('')
    onSearchActiveChange?.(false)
  }
  const submit = () => {
    if (locationState.status === 'loading') {
      setError('선택한 지역의 위치를 확인하고 있어요.')
      return
    }
    if (!pointRegion || locationState.status === 'empty' || locationState.status === 'error') {
      setError('지역의 위치를 확인한 뒤 분석해 주세요.')
      return
    }
    if (!selectedIndustry) {
      setError('분석할 업종을 선택해 주세요.')
      setExpanded(true)
      return
    }
    setError('')
    setExpanded(false)
    onAnalyze(pointRegion, selectedIndustry.businessTypeCode)
  }

  return (
    <section
      className="map-search-overlay reference-search"
      aria-label="지역과 업종 목록"
    >
      <div className="map-search-bar">
        <Search
          size={20}
          aria-hidden="true"
        />
        <div
          className="region-autocomplete"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setFocused(false)
              onSearchActiveChange?.(false)
            }
          }}
        >
          <label
            className="sr-only"
            htmlFor={`${id}-search`}
          >
            지역 검색
          </label>
          <input
            id={`${id}-search`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searching}
            aria-controls={`${id}-results`}
            aria-activedescendant={
              searching && activeIndex >= 0 ? `${id}-${activeIndex}` : undefined
            }
            placeholder={selectedName || '시·군·구 또는 행정동 검색'}
            value={query}
            disabled={pending}
            autoComplete="off"
            onFocus={() => {
              setFocused(true)
              onSearchActiveChange?.(Boolean(query.trim()))
            }}
            onChange={(event) => {
              setQuery(event.target.value)
              setFocused(true)
              setActiveIndex(-1)
              onSearchActiveChange?.(Boolean(event.target.value.trim()))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setFocused(false)
                setActiveIndex(-1)
                onSearchActiveChange?.(false)
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setFocused(true)
                onSearchActiveChange?.(Boolean(query.trim()))
                if (matches.length === 0) return
                setActiveIndex((index) =>
                  event.key === 'ArrowDown'
                    ? Math.min(index + 1, matches.length - 1)
                    : Math.max(index - 1, 0),
                )
              } else if (event.key === 'Enter' && searching && matches[activeIndex]) {
                event.preventDefault()
                choose(matches[activeIndex])
              }
            }}
          />
          {searching && (
            <div className="reference-search-results">
              <ul
                id={`${id}-results`}
                role="listbox"
                aria-label="지역 검색 결과"
              >
                {matches.map((match, index) => (
                  <li
                    key={`${match.type}-${match.type === 'dong' ? match.dong.dongCode : match.district.districtCode}`}
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <button
                      type="button"
                      onClick={() => choose(match)}
                    >
                      <MapPin size={16} />
                      {match.type === 'district'
                        ? match.district.districtName
                        : `${match.district.districtName} ${match.dong.dongName}${match.dong.officialCodeStatus === 'LEGACY' ? ' (과거 코드)' : ''}`}
                    </button>
                  </li>
                ))}
                {matches.length === 0 &&
                  districts.status === 'success' &&
                  districtItems.length > 0 &&
                  searchStatus === 'success' && (
                    <li className="search-no-results">일치하는 지역이 없어요.</li>
                  )}
                {matches.length === 0 &&
                  districts.status === 'success' &&
                  districtItems.length > 0 &&
                  !searchDongs &&
                  searchStatus === 'idle' && (
                    <li className="search-no-results">
                      선택한 구의 목록에 일치하는 지역이 없어요.
                    </li>
                  )}
                {districts.status === 'success' &&
                  districtItems.length > 0 &&
                  searchStatus === 'loading' && (
                    <li
                      className="search-no-results"
                      role="status"
                    >
                      행정동 목록을 불러오고 있어요.
                    </li>
                  )}
                {(searchStatus === 'partial' || searchStatus === 'error') && (
                  <li
                    className="search-no-results"
                    role="status"
                  >
                    일부 행정동 목록을 불러오지 못했어요. ({searchFailedCount}개 구)
                  </li>
                )}
                {!searchDongs && (
                  <li className="search-no-results">자치구와 선택한 구의 행정동에서 검색합니다.</li>
                )}
                {(searchStatus === 'partial' || searchStatus === 'error') && onRetrySearch && (
                  <li>
                    <button
                      type="button"
                      onClick={onRetrySearch}
                    >
                      행정동 검색 다시 불러오기
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        <button
          type="button"
          className="map-filter-toggle"
          aria-label="업종·지역 조건"
          aria-expanded={expanded}
          aria-controls={`${id}-filters`}
          disabled={pending}
          onClick={() => setExpanded((value) => !value)}
        >
          <SlidersHorizontal size={18} />
          <span>조건</span>
        </button>
      </div>
      <div className="map-search-selection">
        <button
          type="button"
          disabled={pending}
          onClick={() => setExpanded(true)}
        >
          <MapPin size={13} />
          {selectedName || '지역 선택'}
          <ChevronDown size={12} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setExpanded(true)}
        >
          {selectedIndustry?.businessTypeName || '업종 선택'}
          <ChevronDown size={12} />
        </button>
        {!expanded && (
          <Button
            className="map-quick-analyze"
            disabled={pending}
            onClick={submit}
          >
            {pending && (
              <LoaderCircle
                size={14}
                className="spin"
              />
            )}
            {pending ? '분석 중' : '상권 분석하기'}
          </Button>
        )}
      </div>
      {locationState.status === 'loading' && (
        <p
          className="reference-location-feedback"
          role="status"
        >
          선택한 지역의 위치를 찾고 있어요.
        </p>
      )}
      {(locationState.status === 'empty' || locationState.status === 'error') && (
        <div
          className="reference-location-feedback"
          role="alert"
        >
          <p>{locationState.message || '선택한 지역의 위치를 찾지 못했어요.'}</p>
          <button
            type="button"
            onClick={onRetryLocation}
          >
            위치 다시 찾기
          </button>
        </div>
      )}
      <div
        id={`${id}-filters`}
        hidden={!expanded}
        className="map-search-filters"
      >
        <form
          className="search-panel"
          aria-label="상권 분석 조건"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <fieldset disabled={pending}>
            <div className="filter-group location-filter">
              <div className="filter-label">
                <MapPin size={17} />
                분석 지역
              </div>
              {pointRegion && !districtCode && (
                <div className="resolved-region-selection">
                  <strong>{pointRegion.fullName}</strong>
                  <span>지도에서 조회한 행정동</span>
                </div>
              )}
              <div className="filter-selects">
                <label className="select-wrap">
                  <span className="sr-only">시·도</span>
                  <select
                    aria-label="시·도"
                    value={provinceCode}
                    onChange={(event) => {
                      setError('')
                      onProvinceChange(event.target.value)
                    }}
                  >
                    <option value="">시·도 선택</option>
                    {provinces.map((province) => (
                      <option
                        key={province.code}
                        value={province.code}
                      >
                        {province.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                  />
                </label>
                <label className="select-wrap">
                  <span className="sr-only">시·군·구</span>
                  <select
                    aria-label="시·군·구"
                    value={districtCode}
                    onChange={(event) => {
                      setError('')
                      onDistrictChange(event.target.value)
                    }}
                    disabled={
                      !provinceCode || districts.status !== 'success' || districtItems.length === 0
                    }
                  >
                    <option value="">시·군·구 선택</option>
                    {districtItems.map((item) => (
                      <option
                        key={item.districtCode}
                        value={item.districtCode}
                      >
                        {item.districtName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                  />
                </label>
                <label className="select-wrap">
                  <span className="sr-only">행정동</span>
                  <select
                    aria-label="행정동"
                    value={dongCode}
                    onChange={(event) => {
                      setError('')
                      onDongChange(event.target.value)
                    }}
                    disabled={!districtCode || dongs.status !== 'success' || dongItems.length === 0}
                  >
                    <option value="">행정동 선택</option>
                    {dongItems.map((item) => (
                      <option
                        key={item.dongCode}
                        value={item.dongCode}
                      >
                        {item.dongName}
                        {item.officialCodeStatus === 'LEGACY' ? ' (과거 코드)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                  />
                </label>
              </div>
            </div>
            <div className="filter-group industry-filter">
              <div className="filter-label">
                <Coffee size={17} />
                분석 업종
              </div>
              <div className="filter-selects">
                <label className="select-wrap">
                  <span className="sr-only">지원 업종</span>
                  <select
                    aria-label="지원 업종"
                    value={businessTypeCode}
                    onChange={(event) => {
                      setError('')
                      onBusinessTypeChange(event.target.value)
                    }}
                    disabled={businessTypes.status !== 'success' || industryItems.length === 0}
                  >
                    <option value="">업종 선택</option>
                    {industryItems.map((item) => (
                      <option
                        key={item.businessTypeCode}
                        value={item.businessTypeCode}
                      >
                        {item.businessTypeName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                  />
                </label>
              </div>
            </div>
            <Button
              type="submit"
              className="analyze-button"
            >
              {pending ? '분석 중' : '상권 분석하기'}
            </Button>
          </fieldset>
        </form>
      </div>
      <div className="reference-feedback">
        <Feedback
          state={districts}
          loading="자치구 목록을 불러오고 있어요."
          empty="자치구 목록이 비어 있어요."
          retryLabel="자치구 다시 불러오기"
          onRetry={onRetryDistricts}
        />
        {districtCode && (
          <Feedback
            state={dongs}
            loading="행정동 목록을 불러오고 있어요."
            empty="행정동 목록이 비어 있어요."
            retryLabel="행정동 다시 불러오기"
            onRetry={onRetryDongs}
          />
        )}
        <Feedback
          state={businessTypes}
          loading="업종 목록을 불러오고 있어요."
          empty="지원 업종이 없어요."
          retryLabel="업종 다시 불러오기"
          onRetry={onRetryBusinessTypes}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="form-error"
        >
          {error}
        </p>
      )}
    </section>
  )
}
