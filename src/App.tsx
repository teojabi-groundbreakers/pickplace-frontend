import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router'
import type { Analysis, Catalog } from './types/analysis'
import { getCatalog } from './lib/api'
import { persistReports, readReports } from './lib/reports'
import { useAnalysis } from './lib/useAnalysis'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Saved } from './pages/Saved'
import { Guide } from './pages/Guide'
import './App.css'
import './styles/map-workspace.css'

function Workspace() {
  const navigate = useNavigate()
  const analysis = useAnalysis()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [reports, setReports] = useState(readReports)
  const [toast, setToast] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    getCatalog(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCatalog(data)
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setCatalogError(
            error instanceof Error ? error.message : '검색 목록을 불러올 수 없습니다.',
          )
      })
    return () => controller.abort()
  }, [catalogAttempt])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4500)
    return () => clearTimeout(timer)
  }, [toast])
  const updateReports = (next: Analysis[], message: string) => {
    try {
      persistReports(next)
      setReports(next)
      setToast(message)
    } catch {
      setToast('저장 공간을 사용할 수 없습니다. 브라우저 설정을 확인해 주세요.')
    }
  }
  const save = (result: Analysis) => {
    const exists = reports.some((item) => item.id === result.id)
    updateReports(
      exists ? reports.filter((item) => item.id !== result.id) : [result, ...reports].slice(0, 20),
      exists ? '저장 목록에서 분석을 삭제했어요.' : '이 브라우저에 분석을 저장했어요.',
    )
  }
  return (
    <Layout savedCount={reports.length}>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              catalog={catalog}
              catalogError={catalogError}
              retryCatalog={() => {
                setCatalogError('')
                setCatalogAttempt((value) => value + 1)
              }}
              state={analysis.state}
              run={analysis.run}
              saved={reports}
              onSave={save}
            />
          }
        />
        <Route
          path="/saved"
          element={
            <Saved
              reports={reports}
              onOpen={(result) => {
                analysis.open(result)
                navigate('/')
              }}
              onRemove={(id) =>
                updateReports(
                  reports.filter((item) => item.id !== id),
                  '저장한 분석을 삭제했어요.',
                )
              }
            />
          }
        />
        <Route
          path="/guide"
          element={<Guide />}
        />
        <Route
          path="*"
          element={
            <section className="empty-state">
              <h1>페이지를 찾을 수 없어요</h1>
              <p>주소를 확인하거나 상권 분석으로 돌아가 주세요.</p>
              <Link
                className="button button-primary"
                to="/"
              >
                상권 분석으로 이동
              </Link>
            </section>
          }
        />
      </Routes>
      {toast && (
        <div
          className="toast"
          role="status"
        >
          <Check size={17} />
          {toast}
          <button
            aria-label="알림 닫기"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Workspace />
    </BrowserRouter>
  )
}
