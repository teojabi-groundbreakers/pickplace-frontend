import { useId, useMemo, useState } from 'react'
import { ChevronDown, LoaderCircle, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import type { AnalysisRequest, Catalog } from '../types/analysis'
import type { MapRegion } from '../types/map'
import type { SearchSelection } from '../lib/selection'
import { validateSelection } from '../lib/validation'
import { SearchForm } from './SearchForm'
import { Button } from './ui'

export function MapSearch({
  catalog,
  regions,
  selection,
  initial,
  pending,
  onChange,
  onRegionSelect,
  onSubmit,
  resolvedRegion,
}: {
  catalog: Catalog
  regions: MapRegion[]
  selection: SearchSelection
  initial: AnalysisRequest
  pending: boolean
  onChange: (selection: SearchSelection) => void
  onRegionSelect: (code: string) => void
  onSubmit: (request: AnalysisRequest) => void
  resolvedRegion?: MapRegion | null
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const selected =
    (resolvedRegion?.code === selection.regionCode ? resolvedRegion : null) ||
    regions.find((region) => region.code === selection.regionCode)
  const industry = catalog.categories
    .flatMap((category) => category.industries)
    .find((item) => item.code === selection.industryCode)
  const matches = useMemo(() => {
    const normalized = query.replace(/\s/g, '').toLocaleLowerCase('ko-KR')
    if (!normalized) return []
    return regions
      .filter((region) =>
        region.fullName.replace(/\s/g, '').toLocaleLowerCase('ko-KR').includes(normalized),
      )
      .slice(0, 8)
  }, [query, regions])
  const searching = focused && query.trim().length > 0
  const choose = (region: MapRegion) => {
    onRegionSelect(region.code)
    setQuery('')
    setFocused(false)
    setActiveIndex(-1)
    setError('')
  }
  const submit = (request: AnalysisRequest) => {
    const message = validateSelection(request, catalog, resolvedRegion?.code)
    setError(message || '')
    if (!message) {
      setExpanded(false)
      setFocused(false)
      onSubmit(request)
    } else setExpanded(true)
  }

  return (
    <div className="map-search-overlay">
      <div className="map-search-bar">
        <Search
          size={20}
          aria-hidden="true"
        />
        <div
          className="region-autocomplete"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
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
            placeholder={selected?.fullName || '시·군·구 또는 행정동 검색'}
            value={query}
            disabled={pending}
            autoComplete="off"
            onFocus={() => setFocused(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setFocused(true)
              setActiveIndex(-1)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setFocused(false)
                setActiveIndex(-1)
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setFocused(true)
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
            <ul
              id={`${id}-results`}
              role="listbox"
              aria-label="지역 검색 결과"
            >
              {matches.map((region, index) => (
                <li
                  key={region.code}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    onClick={() => choose(region)}
                  >
                    <MapPin size={16} />
                    {region.fullName}
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="search-no-results">분석 가능한 지역이 없어요.</li>
              )}
            </ul>
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
          {selected?.name || '지역 선택'}
          <ChevronDown size={12} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setExpanded(true)}
        >
          {industry?.name || '업종 선택'}
          <ChevronDown size={12} />
        </button>
        {!expanded && (
          <Button
            className="map-quick-analyze"
            disabled={pending}
            onClick={() =>
              submit({ regionCode: selection.regionCode, industryCode: selection.industryCode })
            }
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
      <div
        id={`${id}-filters`}
        hidden={!expanded}
        className="map-search-filters"
      >
        <SearchForm
          compact
          catalog={catalog}
          initial={initial}
          value={selection}
          onChange={(value) => {
            setError('')
            onChange(value)
          }}
          pending={pending}
          onSubmit={submit}
          resolvedRegion={resolvedRegion}
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
    </div>
  )
}
