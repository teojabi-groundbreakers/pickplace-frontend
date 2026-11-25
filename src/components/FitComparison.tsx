import { fitComparisonError, type FitMetric, type FitReferenceState } from '../lib/useFitReference'
import './fit-comparison.css'

const formatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

function metricValue(metric: FitMetric | null, unit: string) {
  return metric ? `${formatter.format(metric.value)}${unit}` : '자료 없음'
}

export function FitReferenceIndicators({ state }: { state: FitReferenceState }) {
  if (state.status === 'idle') return null
  if (state.status === 'loading') return <small role="status">비교 지표 조회 중…</small>
  if (state.status === 'error') return <small role="status">{fitComparisonError}</small>
  if (state.status === 'unavailable' && state.reason === 'boundary_unverified') {
    return (
      <small>
        적합도 경계 검증 미달. 서울시와 행안부 자료의 행정동 경계가 기준만큼 겹치지 않습니다.
      </small>
    )
  }
  if (state.status !== 'available') return <small>이 지역에 제공할 비교 지표가 없습니다.</small>

  const { referenceDate, sourceIndustryName, residentsPerStore, storesPerKm2 } = state.reference
  return (
    <div className="ai-fit-comparison">
      <p className="ai-fit-comparison-heading">서울 원천 {sourceIndustryName} 참고 지표</p>
      <p className="ai-indicator-comparison">
        자료 기준일 <time dateTime={referenceDate}>{referenceDate}</time>
      </p>
      <dl>
        <div>
          <dt>점포당 주민 수</dt>
          <dd>{metricValue(residentsPerStore, '명')}</dd>
        </div>
        <div>
          <dt>점포 밀집도</dt>
          <dd>{metricValue(storesPerKm2, '곳/㎢')}</dd>
        </div>
      </dl>
    </div>
  )
}

function metricPercentile(metric: FitMetric | null) {
  return metric?.percentile != null ? formatter.format(metric.percentile) : '자료 없음'
}

export function FitReferenceBenchmark({ state }: { state: FitReferenceState }) {
  if (state.status !== 'available' || state.reference.cohortSize === null) return null
  const { referenceDate, sourceIndustryName, cohortSize, residentsPerStore, storesPerKm2 } =
    state.reference

  return (
    <section
      className="panel ai-fit-benchmark"
      aria-label="서울 동일 업종 비교"
    >
      <h2>서울 동일 업종 비교</h2>
      <p className="ai-fit-benchmark-meta">
        {sourceIndustryName} · 서울 검증 표본 {formatter.format(cohortSize)}개 행정동 ·{' '}
        <time dateTime={referenceDate}>{referenceDate}</time> 기준
      </p>
      <table aria-label="항목별 백분위">
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col">선택 지역</th>
            <th scope="col">백분위</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">점포당 주민 수</th>
            <td>{metricValue(residentsPerStore, '명')}</td>
            <td>{metricPercentile(residentsPerStore)}</td>
          </tr>
          <tr>
            <th scope="row">점포 밀집도</th>
            <td>{metricValue(storesPerKm2, '곳/㎢')}</td>
            <td>{metricPercentile(storesPerKm2)}</td>
          </tr>
        </tbody>
      </table>
      <p className="ai-fit-benchmark-meta">백분위는 검증 표본에서 해당 수치의 상대적 위치입니다.</p>
    </section>
  )
}
