import { useState } from 'react'
import { ChevronDown, Coffee, MapPin, Search, LoaderCircle } from 'lucide-react'
import type { AnalysisRequest, Catalog, Option } from '../types/analysis'
import type { SearchSelection } from '../lib/selection'
import { selectionFromRequest } from '../lib/selection'
import { Button } from './ui'
import { validateSelection } from '../lib/validation'

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}) {
  return (
    <label className="select-wrap">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option
          value=""
          disabled
        >
          {label} 선택
        </option>
        {options.map((option) => (
          <option
            value={option.code}
            key={option.code}
          >
            {option.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        aria-hidden="true"
      />
    </label>
  )
}

export function SearchForm({
  catalog,
  initial,
  pending,
  value,
  onChange,
  onSubmit,
  compact = false,
}: {
  catalog: Catalog
  initial: AnalysisRequest
  pending: boolean
  value?: SearchSelection
  onChange?: (selection: SearchSelection) => void
  onSubmit: (request: AnalysisRequest) => void
  compact?: boolean
}) {
  const [localSelection, setLocalSelection] = useState(() => selectionFromRequest(catalog, initial))
  const selection = value || localSelection
  const { cityCode, districtCode, regionCode, categoryCode, industryCode } = selection
  const [error, setError] = useState('')

  const city = catalog.cities.find((item) => item.code === cityCode)
  const district = city?.districts.find((item) => item.code === districtCode)
  const category = catalog.categories.find((item) => item.code === categoryCode)

  const update = (change: Partial<SearchSelection>) => {
    const next = { ...selection, ...change }
    if (!value) setLocalSelection(next)
    onChange?.(next)
    setError('')
  }

  return (
    <form
      className="search-panel"
      aria-label="상권 분석 조건"
      onSubmit={(event) => {
        event.preventDefault()
        const request = { regionCode, industryCode }
        const message = validateSelection(request, catalog)
        setError(message || '')
        if (!message) onSubmit(request)
      }}
    >
      {!compact && (
        <div className="search-intro">
          <span>02</span>
          <div>
            <h2>어떤 상권이 궁금하세요?</h2>
            <p>지도에서 지역을 고른 뒤 업종을 선택해 주세요.</p>
          </div>
        </div>
      )}
      <fieldset disabled={pending}>
        <div className="filter-group location-filter">
          <div className="filter-label">
            <MapPin size={17} />
            분석 지역
          </div>
          <div className="filter-selects">
            <Select
              label="시·도"
              value={cityCode}
              options={catalog.cities}
              onChange={(code) => update({ cityCode: code, districtCode: '', regionCode: '' })}
            />
            <Select
              label="시·군·구"
              value={districtCode}
              options={city?.districts || []}
              onChange={(code) => update({ districtCode: code, regionCode: '' })}
            />
            <Select
              label="행정동"
              value={regionCode}
              options={district?.neighborhoods || []}
              onChange={(code) => update({ regionCode: code })}
            />
          </div>
        </div>
        <span className="filter-divider" />
        <div className="filter-group industry-filter">
          <div className="filter-label">
            <Coffee size={17} />
            분석 업종
          </div>
          <div className="filter-selects">
            <Select
              label="업종 대분류"
              value={categoryCode}
              options={catalog.categories}
              onChange={(code) => update({ categoryCode: code, industryCode: '' })}
            />
            <Select
              label="세부 업종"
              value={industryCode}
              options={category?.industries || []}
              onChange={(code) => update({ industryCode: code })}
            />
          </div>
        </div>
        <Button
          type="submit"
          className="analyze-button"
        >
          {pending ? (
            <LoaderCircle
              size={18}
              className="spin"
            />
          ) : (
            <Search size={18} />
          )}
          {pending ? '분석 중' : '상권 분석하기'}
        </Button>
      </fieldset>
      {error && (
        <p
          className="form-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  )
}
