import {
  fitMetricPercentileText,
  fitMetricValueText,
  fitNumberFormat,
  fitReferenceNotice,
} from '../lib/aiPresentation'
import type { FitReferenceState } from '../lib/useFitReference'
import './fit-comparison.css'

export function FitReferenceIndicators({ state }: { state: FitReferenceState }) {
  if (state.status !== 'available') {
    const notice = fitReferenceNotice(state)
    return notice ? (
      <small
        className="ai-indicator-comparison"
        role={state.status === 'loading' || state.status === 'error' ? 'status' : undefined}
      >
        {notice}
      </small>
    ) : null
  }

  const { referenceDate, sourceIndustryName, residentsPerStore, storesPerKm2 } = state.reference
  const title = `서울 원천 ${sourceIndustryName} 참고 지표`
  return (
    <section
      className="ai-fit-comparison"
      aria-label={title}
    >
      <h3 className="ai-fit-comparison-heading">{title}</h3>
      <p className="ai-indicator-comparison">
        자료 기준일 <time dateTime={referenceDate}>{referenceDate}</time>
      </p>
      <dl>
        <div>
          <dt>점포당 주민 수</dt>
          <dd>{fitMetricValueText(residentsPerStore, '명')}</dd>
        </div>
        <div>
          <dt>점포 밀집도</dt>
          <dd>{fitMetricValueText(storesPerKm2, '곳/㎢')}</dd>
        </div>
      </dl>
    </section>
  )
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
        {sourceIndustryName} · 서울 검증 표본 {fitNumberFormat.format(cohortSize)}개 행정동 ·{' '}
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
            <td>{fitMetricValueText(residentsPerStore, '명')}</td>
            <td>{fitMetricPercentileText(residentsPerStore)}</td>
          </tr>
          <tr>
            <th scope="row">점포 밀집도</th>
            <td>{fitMetricValueText(storesPerKm2, '곳/㎢')}</td>
            <td>{fitMetricPercentileText(storesPerKm2)}</td>
          </tr>
        </tbody>
      </table>
      <p className="ai-fit-benchmark-meta">백분위는 검증 표본에서 해당 수치의 상대적 위치입니다.</p>
    </section>
  )
}
