import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

const testConfig = vi.hoisted(() => ({
  demoMode: false,
  nationwideRegionsEnabled: false,
}))

vi.mock('../lib/config', () => ({ config: testConfig }))
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('../pages/Dashboard', () => ({ Dashboard: () => <div>데모 화면</div> }))
vi.mock('../pages/ReferenceDashboard', () => ({
  ReferenceDashboard: () => <div>기존 서울 화면</div>,
}))
vi.mock('../pages/NationwideReferenceDashboard', () => ({
  NationwideReferenceDashboard: () => <div>전국 지역 화면</div>,
}))
vi.mock('../lib/useAnalysis', () => ({
  useAnalysis: () => ({ state: { status: 'idle' }, run: vi.fn(), open: vi.fn() }),
}))

import App from '../App'

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  testConfig.demoMode = false
  testConfig.nationwideRegionsEnabled = false
})

describe('전국 지역 선택 모드', () => {
  it('전국 모드를 켜지 않으면 기존 서울 화면을 사용한다', () => {
    render(<App />)

    expect(screen.getByText('기존 서울 화면')).toBeInTheDocument()
    expect(screen.queryByText('전국 지역 화면')).not.toBeInTheDocument()
  })

  it('실제 API 모드에서 명시적으로 켜면 전국 화면을 사용한다', () => {
    testConfig.nationwideRegionsEnabled = true
    render(<App />)

    expect(screen.getByText('전국 지역 화면')).toBeInTheDocument()
    expect(screen.queryByText('기존 서울 화면')).not.toBeInTheDocument()
  })

  it('데모 모드에서는 전국 설정과 관계없이 데모 화면을 유지한다', () => {
    testConfig.demoMode = true
    testConfig.nationwideRegionsEnabled = true
    render(<App />)

    expect(screen.getByText('데모 화면')).toBeInTheDocument()
    expect(screen.queryByText('전국 지역 화면')).not.toBeInTheDocument()
  })
})
