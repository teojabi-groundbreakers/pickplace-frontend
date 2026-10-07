import { ArrowDownRight, ArrowUpRight, Check, Sparkles } from 'lucide-react'
import type { Analysis } from '../types/analysis'
import { Badge } from './ui'

export function Factors({ factors }: { factors: Analysis['factors'] }) {
  const max = Math.max(...factors.map((factor) => Math.abs(factor.contribution)), 1)
  return (
    <section className="panel factors-panel">
      <div className="panel-header">
        <h2>점수에 영향을 준 요인</h2>
        <span className="panel-caption">종합점수 기여도</span>
      </div>
      {factors.length === 0 ? (
        <p className="no-data">제공된 영향 요인이 없습니다.</p>
      ) : (
        <div className="factor-list">
          {factors.map((factor) => (
            <div
              className="factor"
              key={factor.name}
            >
              <span className={`factor-icon ${factor.contribution < 0 ? 'negative' : ''}`}>
                {factor.contribution >= 0 ? (
                  <ArrowUpRight size={17} />
                ) : (
                  <ArrowDownRight size={17} />
                )}
              </span>
              <div className="factor-text">
                <strong>{factor.name}</strong>
                <span>{factor.description}</span>
              </div>
              <div className={`factor-value ${factor.contribution < 0 ? 'negative' : ''}`}>
                <strong>
                  {factor.contribution > 0 ? '+' : ''}
                  {factor.contribution.toFixed(1)}
                  <small>점</small>
                </strong>
                <div>
                  <i style={{ width: `${(Math.abs(factor.contribution) / max) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function Summary({ analysis }: { analysis: Analysis }) {
  return (
    <section className="panel summary-panel">
      <div className="panel-header">
        <h2>
          <Sparkles size={17} />
          AI 상권 인사이트
        </h2>
        <Badge tone="neutral">{analysis.source === 'demo' ? '예시 진단' : '분석 요약'}</Badge>
      </div>
      <p className="summary-text">{analysis.summary}</p>
      <div className="recommendations">
        <span>시작하기 전, 이렇게 준비해 보세요</span>
        {analysis.recommendations.map((item) => (
          <p key={item}>
            <Check size={15} />
            {item}
          </p>
        ))}
      </div>
    </section>
  )
}

export function Competition({ data }: { data: Analysis['competition'] }) {
  return (
    <section className="panel competition-panel">
      <div className="panel-header">
        <h2>주변 상권과 비교하면</h2>
        <div className="chart-legend">
          <span>
            <i />
            선택 상권
          </span>
          <span>
            <i className="legend-other" />
            지역 평균
          </span>
        </div>
      </div>
      <div className="competition-grid">
        {data.length === 0 && <p className="no-data">비교 데이터가 없습니다.</p>}
        {data.map((item) => {
          const max = Math.max(item.local, item.average, 1)
          return (
            <div
              className="comparison"
              key={item.name}
            >
              <span>{item.name}</span>
              <div className="comparison-row">
                <div>
                  <i style={{ width: `${(item.local / max) * 100}%` }} />
                </div>
                <strong>
                  {item.local.toLocaleString('ko-KR')}
                  <small>{item.unit}</small>
                </strong>
              </div>
              <div className="comparison-row average">
                <div>
                  <i style={{ width: `${(item.average / max) * 100}%` }} />
                </div>
                <span>
                  {item.average.toLocaleString('ko-KR')}
                  <small>{item.unit}</small>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
