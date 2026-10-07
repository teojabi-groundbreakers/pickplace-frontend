import { ArrowUpRight, BarChart3, ShieldCheck, Sparkles, Target } from 'lucide-react'
import type { Analysis } from '../types/analysis'
import { Badge } from './ui'

function ScoreMeter({ value, color = '#8da37d' }: { value: number; color?: string }) {
  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 44"
      aria-hidden="true"
    >
      {Array.from({ length: 10 }, (_, index) => (
        <rect
          key={index}
          x={index * 10}
          y="10"
          width="6"
          height="24"
          rx="3"
          fill={index < Math.round(value / 10) ? color : '#edf1e7'}
        />
      ))}
    </svg>
  )
}

export function ScoreCards({ analysis }: { analysis: Analysis }) {
  const { overall, growth, risk, fit } = analysis.scores
  return (
    <div className="score-grid">
      <article className="score-card overall-card">
        <div className="card-kicker">
          <Sparkles size={16} />
          종합 상권 점수
          <span
            className="help-hint"
            title="성장성, 위험도, 업종 적합도 등 주요 지표를 종합한 100점 만점 점수입니다."
          >
            ?
          </span>
        </div>
        <div className="overall-body">
          <div
            className="score-ring"
            style={{ background: `conic-gradient(#d5e6b3 ${overall.value}%, #ffffff20 0)` }}
          >
            <div>
              <strong>{overall.value}</strong>
              <span>/ 100</span>
            </div>
          </div>
          <div className="overall-description">
            <span className="grade">
              {overall.grade}등급 <ArrowUpRight size={15} />
            </span>
            <p>{overall.description}</p>
          </div>
        </div>
        <div className="score-footer">
          <span className="status-dot" />
          상권의 여러 지표를 종합한 점수
        </div>
      </article>
      <article className="score-card">
        <div className="card-kicker">
          <BarChart3 size={16} />
          성장 가능성<Badge>{growth.grade}</Badge>
        </div>
        <div className="metric-main">
          <div>
            <strong>{growth.value}</strong>
            <span>점</span>
          </div>
          <ScoreMeter value={growth.value} />
        </div>
        <p>{growth.description}</p>
        <div className="metric-caption">높을수록 성장 가능성이 높아요</div>
      </article>
      <article className="score-card">
        <div className="card-kicker">
          <ShieldCheck size={16} />
          위험도<Badge tone="orange">{risk.grade}</Badge>
        </div>
        <div className="metric-main">
          <div>
            <strong>{risk.value}</strong>
            <span>점</span>
          </div>
          <ScoreMeter
            value={risk.value}
            color="#c9aa7f"
          />
        </div>
        <p>{risk.description}</p>
        <div className="metric-caption">낮을수록 안정적인 상권이에요</div>
      </article>
      <article className="score-card">
        <div className="card-kicker">
          <Target size={16} />
          업종 적합도<Badge>{fit.grade}</Badge>
        </div>
        <div className="metric-main">
          <div>
            <strong>{fit.value}</strong>
            <span>점</span>
          </div>
          <span className="fit-symbol">
            <Target
              size={35}
              strokeWidth={1.2}
            />
          </span>
        </div>
        <p>{fit.description}</p>
        <div className="fit-track">
          <span style={{ width: `${fit.value}%` }} />
        </div>
      </article>
    </div>
  )
}
