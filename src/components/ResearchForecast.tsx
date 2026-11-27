import { ArrowRight } from 'lucide-react'
import type { ResearchForecast as ResearchForecastData } from '../types/analysis'
import { researchGrowthFormat, researchReasonText } from '../lib/aiPresentation'
import { Badge } from './ui'

const historyWarning = '과거 최초 공개 시점과 데이터 버전은 검증되지 않았습니다.'
const inputWarning = '요청에 사용된 입력값의 출처와 진위는 검증되지 않았습니다.'
const regionWarning = '행정동 코드 대응과 지역별 모델 적용 범위는 검증되지 않았습니다.'

const warningLabels: Record<string, string> = {
  research_only_not_point_in_time_validated: historyWarning,
  low_industry_test_sample: '해당 업종의 시험 표본이 적어 결과가 불안정할 수 있습니다.',
  scope_absent_from_training: '이 지역과 업종의 조합은 모델 학습에 포함되지 않았습니다.',
  comparison_sales_below_1m_krw: '비교 기준 매출이 작아 성장률이 크게 변할 수 있습니다.',
  'Research-only estimates from revised snapshots; historical publication versions and prospective performance are unverified.':
    '후향 시험에는 수정된 자료를 사용했습니다.',
  'The caller supplies the history; input values and provenance are unverified.': inputWarning,
  'H10-to-Seoul code mapping and geographic applicability are not verified.': regionWarning,
}

function estimateLabel(kind: ResearchForecastData['predictions'][number]['estimateKind']) {
  return kind === 'completed_quarter_unobserved_estimate'
    ? '종료된 분기의 추정'
    : '진행 중 또는 이후 분기의 추정'
}

export function ResearchForecast({
  data,
  scopeLabel,
}: {
  data?: ResearchForecastData | null
  scopeLabel?: string
}) {
  if (!data) return null

  const validationNotes = [historyWarning]
  if (!data.regionScopeVerified) validationNotes.push(regionWarning)
  if (!data.inputValuesVerified) validationNotes.push(inputWarning)

  return (
    <section
      className="panel research-forecast"
      aria-label="연구용 매출 성장률 추정"
    >
      <div className="panel-header">
        <h2>분기별 매출 성장률 추정</h2>
        <Badge tone="neutral">연구용</Badge>
      </div>
      <div className="research-forecast-body">
        {scopeLabel && <p className="research-forecast-scope">{scopeLabel}</p>}
        <div className="research-forecast-flow">
          <dl className="research-forecast-input">
            <dt>입력 기준</dt>
            <dd>{data.basePeriod}</dd>
          </dl>
          <ArrowRight
            className="research-forecast-arrow"
            size={20}
            aria-hidden="true"
          />
          <ul
            className="research-forecast-targets"
            role="list"
            aria-label="추정 대상 분기"
          >
            {data.predictions.map((prediction) => (
              <li key={prediction.targetPeriod}>
                <p className="research-forecast-label">추정 대상</p>
                <h3>{prediction.targetPeriod}</h3>
                <p className="research-forecast-label">{estimateLabel(prediction.estimateKind)}</p>
                {prediction.status === 'available' && prediction.estimatedYoYGrowth !== null ? (
                  <p className="research-forecast-growth">
                    <strong>{researchGrowthFormat.format(prediction.estimatedYoYGrowth)}</strong>
                    <span>전년 동기 대비</span>
                  </p>
                ) : (
                  <p className="research-forecast-unavailable">
                    <strong>추정 불가</strong>
                    <span>{researchReasonText(prediction.reason)}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="research-forecast-note">
          서울시 행정동·업종별 추정매출을 바탕으로 한 연구 결과이며 실제 예측 성능은 검증되지
          않았습니다.
        </p>
        <details className="research-forecast-details">
          <summary>출처와 검증 상세</summary>
          <div className="research-forecast-details-body">
            <dl className="research-forecast-metadata">
              <div>
                <dt>출처</dt>
                <dd>서울시 상권분석서비스 추정매출·점포(행정동)</dd>
              </div>
              <div>
                <dt>데이터 확보일</dt>
                <dd>
                  <time dateTime={data.dataAsOf}>{data.dataAsOf}</time>
                </dd>
              </div>
              <div>
                <dt>산출 방식</dt>
                <dd>{data.method === 'precomputed_snapshot' ? '사전 계산값' : '모델 추론'}</dd>
              </div>
              <div>
                <dt>모델 버전</dt>
                <dd>{data.modelVersion}</dd>
              </div>
            </dl>
            <ul className="research-forecast-warnings">
              {validationNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            {data.predictions.map(({ targetPeriod, retrospectiveTest, warnings }) => {
              const notes = [
                ...new Set(
                  warnings.map((warning) =>
                    Object.hasOwn(warningLabels, warning) ? warningLabels[warning] : warning,
                  ),
                ),
              ].filter((warning) => !validationNotes.includes(warning))
              if (!retrospectiveTest && notes.length === 0) return null

              return (
                <div
                  className="research-forecast-validation"
                  key={targetPeriod}
                >
                  <h3>{targetPeriod} 검증 내역</h3>
                  {retrospectiveTest && (
                    <>
                      <p>{retrospectiveTest.targetPeriod} 후향 시험</p>
                      <dl className="research-forecast-metadata">
                        <div>
                          <dt>표본</dt>
                          <dd>{retrospectiveTest.rows.toLocaleString('ko-KR')}건</dd>
                        </div>
                        <div>
                          <dt>평균 절대오차</dt>
                          <dd>{retrospectiveTest.maePp.toFixed(2)}%p</dd>
                        </div>
                        <div>
                          <dt>중앙 절대오차</dt>
                          <dd>{retrospectiveTest.medianAbsoluteErrorPp.toFixed(2)}%p</dd>
                        </div>
                      </dl>
                      <p>후향 시험 오차는 해당 과거 표본의 추정 오차를 나타냅니다.</p>
                    </>
                  )}
                  {notes.length > 0 && (
                    <ul className="research-forecast-warnings">
                      {notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      </div>
    </section>
  )
}
