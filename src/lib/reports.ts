import type { Analysis } from '../types/analysis'
import { isAnalysis } from './validation'

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

export function downloadReport(result: Analysis): void {
  const text = [
    'PickPlace 상권 분석 보고서',
    `${result.regionName} · ${result.industryName}`,
    `기준: ${result.period} | ${result.source === 'demo' ? '예시 데이터 (실제 투자 판단에 사용하지 마세요)' : 'API 분석 데이터'}`,
    '',
    ...Object.entries(result.scores).map(
      ([key, score]) =>
        `${{ overall: '종합점수', growth: '성장 가능성', risk: '위험도 (높을수록 위험)', fit: '업종 적합도' }[key]}: ${score.value}점 · ${score.grade}`,
    ),
    '',
    '진단 요약',
    result.summary,
    '',
    '주요 영향 요인',
    ...result.factors.map(
      (factor) =>
        `${factor.name}: ${factor.contribution > 0 ? '+' : ''}${factor.contribution}점 — ${factor.description}`,
    ),
    '',
    '추천 확인 사항',
    ...result.recommendations.map((item, index) => `${index + 1}. ${item}`),
    '',
    '월별 데이터 (매출: 만원, 유동인구: 일평균 명, 점포: 개)',
    ...result.trends.map(
      (point) =>
        `${point.month} | 매출 ${point.sales} | 유동인구 ${point.population} | 점포 ${point.stores} | 개업 ${point.openings} | 폐업 ${point.closures}`,
    ),
  ].join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `PickPlace_${result.regionName}_${result.period}.txt`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
