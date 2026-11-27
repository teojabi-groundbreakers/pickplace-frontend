import { ArrowDownToLine, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { Analysis } from '../types/analysis'
import { downloadReport, type ReportReferences } from '../lib/reports'
import { Button } from './ui'

export function ReportDownloadButton({
  result,
  getReferences,
  iconOnly = false,
}: {
  result: Analysis
  getReferences?: () => ReportReferences | undefined
  iconOnly?: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'preparing' | 'error'>('idle')
  const preparing = status === 'preparing'
  const label = preparing ? 'PDF 준비 중…' : '보고서 다운로드'
  const Icon = preparing ? LoaderCircle : ArrowDownToLine

  async function saveReport() {
    setStatus('preparing')
    try {
      await downloadReport(result, getReferences?.())
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  const icon = (
    <Icon
      size={iconOnly ? 17 : 15}
      className={preparing ? 'spin' : undefined}
      aria-hidden="true"
    />
  )

  return (
    <div>
      {iconOnly ? (
        <button
          className="icon-button"
          type="button"
          aria-label={`${result.regionName} ${label}`}
          aria-busy={preparing}
          disabled={preparing}
          onClick={() => void saveReport()}
        >
          {icon}
        </button>
      ) : (
        <Button
          variant="secondary"
          type="button"
          aria-busy={preparing}
          disabled={preparing}
          onClick={() => void saveReport()}
        >
          {icon}
          <span>{label}</span>
        </Button>
      )}
      {status === 'error' && (
        <p
          className="form-error"
          role="alert"
        >
          PDF를 저장하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
    </div>
  )
}
