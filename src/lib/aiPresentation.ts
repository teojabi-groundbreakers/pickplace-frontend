import type { AiAnalysisDisplay, AiPeriodGrowth } from '../types/analysis'
import { aiReasonText } from './aiAnalysis'

export function aiBasePeriodText(period: string | null): string {
  return period ? `${period} 기준` : '기준 분기 미확정'
}

export function aiGrowthPeriodsText(growth: AiPeriodGrowth): string {
  const periods = []
  if (growth.targetPeriod) periods.push(`예측 대상 ${growth.targetPeriod}`)
  if (growth.comparisonPeriod) periods.push(`비교 ${growth.comparisonPeriod}`)
  return periods.join(' · ')
}

const statLabels: Record<string, { name: string; unit: string }> = {
  registeredPopulation: { name: '등록인구', unit: '명' },
  listedStoreCount: { name: '등록 점포 수', unit: '개' },
  residentPopulation: { name: '상주인구', unit: '명' },
  totalStoreCount: { name: '전체 점포 수', unit: '개' },
}

const statReasons: Record<string, string> = {
  SOURCE_SUPPRESSED: '원천에서 공개하지 않은 값입니다.',
  CLASSIFICATION_MISMATCH: '원천의 업종 분류가 일치하지 않습니다.',
  MAPPING_UNRESOLVED: '원천과 서비스의 코드 대응을 확인하지 못했습니다.',
  BOUNDARY_REVIEW_PENDING: '행정구역 경계 검토가 필요합니다.',
  BOUNDARY_MISMATCH: '원천과 서비스의 행정구역 경계가 다릅니다.',
  COUNT_INCOMPLETE: '집계가 완료되지 않았습니다.',
  QUALITY_CHECK_FAILED: '자료 품질 검증을 통과하지 못했습니다.',
  SOURCE_REGION_ABSENT: '원천에 해당 지역 자료가 없습니다.',
  SOURCE_ROW_ABSENT: '원천에 해당 조건의 자료가 없습니다.',
  SOURCE_VALUE_MISSING: '원천에 값이 없습니다.',
}

export function aiStatisticsRows(statistics: AiAnalysisDisplay['statistics']) {
  return Object.entries(statistics.metrics).map(([key, metric]) => {
    const label = Object.hasOwn(statLabels, key) ? statLabels[key] : undefined
    const reason = metric.reasonCode
    const status = metric.status === 'NO_DATA' ? '자료 없음' : '제공 불가'

    return {
      key,
      name: label?.name ?? key,
      display:
        metric.status === 'AVAILABLE' && metric.value !== null
          ? `${metric.value.toLocaleString('ko-KR')}${label?.unit ?? ''}`
          : `${status} · ${reason && Object.hasOwn(statReasons, reason) ? statReasons[reason] : aiReasonText(reason)}`,
    }
  })
}
