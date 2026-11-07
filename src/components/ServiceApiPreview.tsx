import { Database, MapPin, Server } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '../lib/api'
import { getDatabaseReadiness, getDistricts, getServiceHealth } from '../lib/serviceApi'

type CheckFailure = { status: 'error'; message: string; requestId?: string }

type CheckState<T> =
  { status: 'idle' } | { status: 'loading' } | { status: 'success'; data: T } | CheckFailure

type Health = Awaited<ReturnType<typeof getServiceHealth>>['data']
type Districts = Awaited<ReturnType<typeof getDistricts>>['data']

function describeFailure(error: unknown): CheckFailure {
  if (!(error instanceof ApiError)) {
    return { status: 'error', message: '서비스 확인을 완료하지 못했어요.' }
  }

  let message = error.message
  if (error.status === 503) message = '서비스가 아직 준비되지 않았어요. (503)'
  if (error.status === 404) message = '요청한 API를 찾을 수 없어요. (404)'

  return { status: 'error', message, requestId: error.requestId }
}

async function runCheck<T>(
  load: (signal: AbortSignal) => Promise<{ data: T }>,
  signal: AbortSignal,
  update: (state: CheckState<T>) => void,
) {
  try {
    const { data } = await load(signal)
    if (!signal.aborted) update({ status: 'success', data })
  } catch (error) {
    if (!signal.aborted) update(describeFailure(error))
  }
}

function checkMessage(state: CheckState<unknown>, successMessage: string) {
  switch (state.status) {
    case 'idle':
      return '아직 확인하지 않았어요.'
    case 'loading':
      return '확인 중이에요.'
    case 'success':
      return successMessage
    case 'error':
      return state.message
  }
}

function CheckRow({
  title,
  icon: Icon,
  state,
  successMessage,
  children,
}: {
  title: string
  icon: LucideIcon
  state: CheckState<unknown>
  successMessage: string
  children?: ReactNode
}) {
  const titleId = useId()

  return (
    <div>
      <span
        className="guide-metric-icon"
        aria-hidden="true"
      >
        <Icon size={20} />
      </span>
      <section aria-labelledby={titleId}>
        <h3 id={titleId}>{title}</h3>
        <p role="status">
          {checkMessage(state, successMessage)}
          {state.status === 'error' && state.requestId && (
            <>
              {' · 요청 ID: '}
              <code style={{ overflowWrap: 'anywhere' }}>{state.requestId}</code>
            </>
          )}
        </p>
        {children}
      </section>
    </div>
  )
}

export function ServiceApiPreview() {
  const titleId = useId()
  const [server, setServer] = useState<CheckState<Health>>({ status: 'idle' })
  const [database, setDatabase] = useState<CheckState<Health>>({ status: 'idle' })
  const [districts, setDistricts] = useState<CheckState<Districts>>({ status: 'idle' })
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => () => activeRequest.current?.abort(), [])

  function checkService() {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller

    setServer({ status: 'loading' })
    setDatabase({ status: 'loading' })
    setDistricts({ status: 'loading' })

    void runCheck(getServiceHealth, controller.signal, setServer)
    void runCheck(getDatabaseReadiness, controller.signal, setDatabase)
    void runCheck(getDistricts, controller.signal, setDistricts)
  }

  const hasFailure = [server, database, districts].some((check) => check.status === 'error')
  const items = districts.status === 'success' ? districts.data.items : []
  const districtsMessage = items.length
    ? `서울 자치구 ${items.length}개를 불러왔어요.`
    : '조회는 성공했지만 표시할 자치구가 없어요.'
  const actionLabel = hasFailure
    ? '다시 시도'
    : server.status === 'idle'
      ? '서비스 연결 확인'
      : '다시 확인'

  return (
    <section
      className="panel guide-metrics"
      aria-labelledby={titleId}
    >
      <h2 id={titleId}>서비스 API 연결 확인</h2>
      <p>
        데모 분석과 별도로 실제 서비스 API의 상태와 서울 자치구 목록을 확인합니다. 이 목록은 상권
        분석 조건이나 결과에 반영되지 않아요.
      </p>
      <div>
        <button
          className="button button-primary"
          type="button"
          onClick={checkService}
        >
          {actionLabel}
        </button>
      </div>
      <CheckRow
        title="서비스 서버"
        icon={Server}
        state={server}
        successMessage="서버가 실행 중이에요."
      />
      <CheckRow
        title="데이터베이스"
        icon={Database}
        state={database}
        successMessage="데이터베이스가 준비됐어요."
      />
      <CheckRow
        title="서울 자치구 목록"
        icon={MapPin}
        state={districts}
        successMessage={districtsMessage}
      >
        {items.length > 0 && (
          <details>
            <summary>자치구와 코드 보기</summary>
            <ul>
              {items.map((item) => (
                <li key={item.code}>
                  {item.name} · <code>{item.code}</code>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CheckRow>
    </section>
  )
}
