import { ArrowRight, ArrowDownToLine, Bookmark, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import type { Analysis } from '../types/analysis'
import { Badge, Button } from '../components/ui'
import { downloadReport } from '../lib/reports'

export function Saved({
  reports,
  onOpen,
  onRemove,
}: {
  reports: Analysis[]
  onOpen: (analysis: Analysis) => void
  onRemove: (id: string) => void
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR PLACES, YOUR POSSIBILITIES</span>
          <h1>
            저장한 분석<span className="title-period">.</span>
          </h1>
          <p>눈여겨본 상권을 모아두고, 차근차근 비교해 보세요.</p>
        </div>
        <Badge tone="neutral">{reports.length}개의 분석</Badge>
      </div>
      <p className="storage-notice">
        이 브라우저에 최대 20개의 분석이 저장됩니다. 최근 저장한 분석부터 표시됩니다.
      </p>
      {reports.length === 0 ? (
        <section className="empty-state">
          <span className="state-icon">
            <Bookmark size={28} />
          </span>
          <h2>발견한 가능성을 저장해 보세요</h2>
          <p>상권 분석 화면에서 ‘분석 저장’을 누르면 여기에 모아볼 수 있어요.</p>
          <Link
            className="button button-primary"
            to="/"
          >
            상권 분석하러 가기 <ArrowRight size={16} />
          </Link>
        </section>
      ) : (
        <div className="saved-grid">
          {reports.map((report) => (
            <article
              className="panel saved-card"
              key={report.id}
            >
              <div className="saved-card-top">
                <Badge tone={report.source === 'demo' ? 'neutral' : 'green'}>
                  {report.source === 'demo' ? '예시 분석' : '상권 분석'}
                </Badge>
                <button
                  className="icon-button"
                  aria-label={`${report.regionName} 분석 삭제`}
                  onClick={() => onRemove(report.id)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <h2>{report.regionName}</h2>
              <p>{report.industryName}</p>
              <div className="saved-score">
                <strong>
                  {report.scores.overall.value}
                  <small>점</small>
                </strong>
                <Badge>{report.scores.overall.grade}등급</Badge>
                <span>{report.period} 기준</span>
              </div>
              <div className="saved-card-bottom">
                <Button
                  variant="ghost"
                  onClick={() => onOpen(report)}
                >
                  분석 다시 보기 <ArrowRight size={15} />
                </Button>
                <button
                  className="icon-button"
                  aria-label={`${report.regionName} 보고서 다운로드`}
                  onClick={() => downloadReport(report)}
                >
                  <ArrowDownToLine size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
