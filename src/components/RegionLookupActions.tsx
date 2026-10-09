import { useState } from 'react'
import type { MapRegion, RegionAnalysisOptions } from '../types/map'

export function RegionLookupActions({
  region,
  analysis,
  disabled,
  onExplore,
}: {
  region: MapRegion
  analysis: RegionAnalysisOptions
  disabled?: boolean
  onExplore: (region: MapRegion) => void
}) {
  const [error, setError] = useState('')
  const available = analysis.categories.some((category) => category.industries.length > 0)

  return (
    <form
      className="lookup-analysis-form"
      aria-label="조회 지역 분석 조건"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled || !available) return
        const valid = analysis.categories.some((category) =>
          category.industries.some((industry) => industry.code === analysis.industryCode),
        )
        if (!valid) {
          setError('분석할 업종을 선택해 주세요.')
          return
        }
        setError('')
        analysis.onAnalyze(region, analysis.industryCode)
      }}
    >
      <label className="lookup-industry-select">
        <span>분석할 업종</span>
        <select
          value={analysis.industryCode}
          disabled={disabled || !available}
          required
          onChange={(event) => {
            setError('')
            analysis.onIndustryChange(event.target.value)
          }}
        >
          <option value="">업종을 선택해 주세요</option>
          {analysis.categories.map((category) => (
            <optgroup
              key={category.code}
              label={category.name}
            >
              {category.industries.map((industry) => (
                <option
                  key={industry.code}
                  value={industry.code}
                >
                  {industry.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {!available && (
        <p>업종 목록을 불러온 뒤 분석할 수 있어요. 둘러보기는 계속 사용할 수 있어요.</p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="lookup-actions">
        <button
          type="submit"
          className="button button-primary"
          disabled={disabled || !available}
        >
          {disabled ? '분석 중' : '이 지역 분석'}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onExplore(region)}
        >
          이 지역 둘러보기
        </button>
      </div>
    </form>
  )
}
