import type { ResearchForecast as ResearchForecastData } from '../types/analysis'

const warningLabels: Record<string, string> = {
  research_only_not_point_in_time_validated:
    '과거 최초 공개 시점과 데이터 버전을 확인하지 못한 연구용 결과입니다.',
  low_industry_test_sample: '해당 업종의 시험 표본이 적어 결과가 불안정할 수 있습니다.',
  scope_absent_from_training: '이 지역과 업종의 조합은 모델 학습에 포함되지 않았습니다.',
  comparison_sales_below_1m_krw: '비교 기준 매출이 작아 성장률이 크게 변할 수 있습니다.',
  'Research-only estimates from revised snapshots; historical publication versions and prospective performance are unverified.':
    '수정된 자료로 평가한 연구용 결과이며 과거 공개 버전과 전향 성능은 확인되지 않았습니다.',
  'The caller supplies the history; input values and provenance are unverified.':
    '요청에 포함된 데이터 값과 출처는 독립적으로 검증되지 않았습니다.',
  'H10-to-Seoul code mapping and geographic applicability are not verified.':
    '행정동 코드 대응과 지역별 모델 적용 가능성은 확인되지 않았습니다.',
}

const reasonLabels: Record<string, string> = {
  insufficient_history: '필요한 연속 분기 이력이 부족합니다.',
  missing_sales: '필요한 매출 자료가 없습니다.',
  invalid_sales_denominator: '성장률을 계산할 기준 매출이 없습니다.',
  missing_or_nonpositive_comparison_sales: '전년 동기의 비교 매출이 없거나 0입니다.',
  unsupported_or_insufficient_scope: '이 지역과 업종의 추정 결과를 제공할 수 없습니다.',
  unsupported_region_or_industry_code: '지원하지 않는 지역 또는 업종 코드입니다.',
  unsupported_source_or_region_code_system: '지원하지 않는 자료 출처 또는 지역 코드 체계입니다.',
  unsupported_forecast_period: '지원하지 않는 기준 분기 또는 예측 분기입니다.',
  as_of_before_model_snapshot: '모델의 데이터 확보일보다 이른 기준일은 사용할 수 없습니다.',
  as_of_in_future: '아직 오지 않은 날짜를 기준일로 사용할 수 없습니다.',
}

function estimateLabel(kind: ResearchForecastData['predictions'][number]['estimateKind']) {
  return kind === 'completed_quarter_unobserved_estimate'
    ? '종료된 분기의 추정'
    : '진행 중 또는 이후 분기의 추정'
}

export function ResearchForecast({ data }: { data?: ResearchForecastData | null }) {
  if (!data) return null

  return (
    <section
      className="panel research-forecast"
      aria-label="연구용 매출 성장률 추정"
    >
      <div className="panel-header">
        <h2>분기별 매출 성장률 추정</h2>
        <span>연구용</span>
      </div>
      <p>서울시 행정동·업종별 추정매출의 전년 동기 대비 변화율입니다.</p>
      <p>
        입력 기준: {data.basePeriod} · 데이터 확보일: {data.dataAsOf} · 모델: {data.modelVersion}
      </p>
      <p>
        {data.method === 'precomputed_snapshot' ? '미리 생성한 결과' : '모델 추론 결과'} · 과거 최초
        공개 시점은 검증되지 않았으며, 창업 성공 확률이나 보장된 성과가 아닙니다.
      </p>
      {!data.regionScopeVerified && <p>지역별 학습 범위는 검증되지 않았습니다.</p>}
      {!data.inputValuesVerified && (
        <p>요청에 사용된 입력값의 출처와 진위는 검증되지 않았습니다.</p>
      )}
      <ul>
        {data.predictions.map((prediction) => (
          <li key={prediction.targetPeriod}>
            <strong>{prediction.targetPeriod}</strong> · {estimateLabel(prediction.estimateKind)}{' '}
            {prediction.status === 'available' && prediction.estimatedYoYGrowth !== null ? (
              <span>
                · 전년 동기 대비 {prediction.estimatedYoYGrowth > 0 ? '+' : ''}
                {(prediction.estimatedYoYGrowth * 100).toFixed(1)}%
              </span>
            ) : (
              <span>
                {' '}
                · 추정 불가: {reasonLabels[prediction.reason ?? ''] ?? prediction.reason}
              </span>
            )}
            {prediction.retrospectiveTest && (
              <p>
                {prediction.retrospectiveTest.targetPeriod} 후향 시험 (
                {prediction.retrospectiveTest.rows.toLocaleString('ko-KR')}건): 평균 오차{' '}
                {prediction.retrospectiveTest.maePp.toFixed(2)}%p · 중앙 오차{' '}
                {prediction.retrospectiveTest.medianAbsoluteErrorPp.toFixed(2)}%p. 향후 정확도나
                예측구간은 아닙니다.
              </p>
            )}
            {prediction.warnings.length > 0 && (
              <ul>
                {prediction.warnings.map((warning) => (
                  <li key={warning}>{warningLabels[warning] ?? warning}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
