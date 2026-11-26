import reportFontUrl from '../assets/Pretendard-Regular.ttf?url'
import type { Analysis } from '../types/analysis'
import { buildReportPdfModel, type ReportReferences } from './reportPdfModel'
import { isAnalysis } from './validation'

export type { ReportReferences } from './reportPdfModel'

const storageKey = 'pickplace.reports.v1'

export function readReports(): Analysis[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
    return Array.isArray(data) ? data.filter(isAnalysis).slice(0, 20) : []
  } catch {
    return []
  }
}

export function persistReports(reports: Analysis[]): void {
  localStorage.setItem(storageKey, JSON.stringify(reports.slice(0, 20)))
}

export async function downloadReport(
  result: Analysis,
  references?: ReportReferences,
): Promise<void> {
  const [{ renderReportPdf }, fontResponse] = await Promise.all([
    import('./reportPdf'),
    fetch(reportFontUrl),
  ])
  if (!fontResponse.ok) throw new Error('보고서 글꼴을 불러오지 못했습니다.')
  const bytes = await renderReportPdf(
    buildReportPdfModel(result, references),
    await fontResponse.arrayBuffer(),
  )
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  const title = `PickPlace_${result.regionName}_${result.ai?.asOf ?? result.period ?? result.analyzedAt.slice(0, 10)}`
  anchor.href = url
  anchor.download = `${title.replace(/[\\/:*?"<>|]/g, '-')}.pdf`
  try {
    document.body.append(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}
