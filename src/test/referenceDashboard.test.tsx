import type { ReactNode } from 'react'
import { config } from '../lib/config'
import { useAnalysis } from '../lib/useAnalysis'
import { createDemoAnalysis, defaultRequest } from '../data/demo'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReferenceDashboard } from '../pages/ReferenceDashboard'

const api = vi.hoisted(() => ({
  getDistricts: vi.fn(),
  getAdministrativeDongs: vi.fn(),
  getBusinessTypes: vi.fn(),
}))
const map = vi.hoisted(() => ({ latest: null as Record<string, unknown> | null }))

vi.mock('../lib/backendReference', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/backendReference')>()),
  ...api,
}))
vi.mock('../components/AreaMap', () => ({
  AreaMap: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
    map.latest = props
    const analysis = props.analysis as {
      onAnalyze: (
        region: { code: string; name: string; fullName: string; center: [number, number] },
        industryCode: string,
      ) => void
    }
    return (
      <div data-testid="reference-map">
        {children}
        <button onClick={() => (props.onUserInteraction as (() => void) | undefined)?.()}>
          지도 조작
        </button>
        <button
          onClick={() =>
            analysis.onAnalyze(
              {
                code: '1111051500',
                name: '청운효자동',
                fullName: '서울 종로구 청운효자동',
                center: [37.58, 126.97],
              },
              'CS100010',
            )
          }
        >
          지도 위치 분석
        </button>
      </div>
    )
  },
}))

const districts = [
  { districtCode: '11110', districtName: '종로구' },
  { districtCode: '11140', districtName: '중구' },
]
const businessTypes = [
  { businessTypeCode: 'CS100010', businessTypeName: '커피·음료', supported: true },
  { businessTypeCode: 'CS100008', businessTypeName: '분식', supported: true },
]
const dongs = [
  {
    dongCode: '11110515',
    dongName: '청운효자동',
    districtCode: '11110',
    officialCodeStatus: 'CURRENT',
    regionVersion: 'seoul-v1',
  },
  {
    dongCode: '11110530',
    dongName: '과거행정동',
    districtCode: '11110',
    officialCodeStatus: 'LEGACY',
    regionVersion: 'seoul-v1',
  },
]
const payload = <T,>(items: T[]) => ({ items, requestId: 'test-request' })

function DashboardUnderTest() {
  const { state, run } = useAnalysis()
  return (
    <ReferenceDashboard
      state={state}
      run={run}
      saved={[]}
      onSave={() => {}}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  map.latest = null
  api.getDistricts.mockResolvedValue(payload(districts))
  api.getBusinessTypes.mockResolvedValue(payload(businessTypes))
  api.getAdministrativeDongs.mockResolvedValue(payload(dongs))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('실제 백엔드 기준정보 화면', () => {
  it('기존 검색창에서 서버가 제공한 행정동을 찾고 선택하되 좌표나 분석을 추정하지 않는다', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    api.getAdministrativeDongs.mockImplementation((code: string) =>
      Promise.resolve(payload(code === '11110' ? dongs : [])),
    )
    render(<DashboardUnderTest />)
    const search = await screen.findByRole('combobox', { name: '지역 검색' })
    const toggle = screen.getByRole('button', { name: '업종·지역 조건' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(api.getAdministrativeDongs).not.toHaveBeenCalled()
    await user.type(search, '청운')
    await user.click(await screen.findByRole('button', { name: '종로구 청운효자동' }))
    await user.click(toggle)
    await waitFor(() => expect(screen.getByLabelText('행정동')).toHaveValue('11110515'))
    expect(map.latest?.selectedRegionCode).toBe('')
    expect(JSON.stringify(map.latest)).not.toContain('1111051500')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(screen.getByRole('alert')).toHaveTextContent('지역의 위치를 확인한 뒤 분석해 주세요.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('전체 동 검색의 일부 구가 실패하면 불완전한 결과를 안내하고 실패한 구를 재시도한다', async () => {
    const user = userEvent.setup()
    let failed = false
    api.getAdministrativeDongs.mockImplementation((code: string) => {
      if (code === '11140' && !failed) {
        failed = true
        return Promise.reject(new Error('중구 조회 실패'))
      }
      const items =
        code === '11140'
          ? [{ ...dongs[0], dongCode: '11140515', dongName: '중구 행정동', districtCode: '11140' }]
          : dongs
      return Promise.resolve(payload(items))
    })
    render(<DashboardUnderTest />)
    await user.type(await screen.findByRole('combobox', { name: '지역 검색' }), '중구')
    expect(await screen.findByText(/일부 행정동 목록을 불러오지 못했어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '중구' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '중구 중구 행정동' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '행정동 검색 다시 불러오기' }))
    expect(await screen.findByRole('button', { name: '중구 중구 행정동' })).toBeInTheDocument()
    expect(screen.queryByText(/일부 행정동 목록을 불러오지 못했어요/)).not.toBeInTheDocument()
    expect(api.getAdministrativeDongs.mock.calls.filter(([code]) => code === '11140')).toHaveLength(
      2,
    )
    expect(api.getAdministrativeDongs.mock.calls.filter(([code]) => code === '11110')).toHaveLength(
      1,
    )
  })

  it('서버의 구·동·업종을 표시하고 8자리 동을 지도 좌표나 H10으로 바꾸지 않는다', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    const district = await screen.findByLabelText('자치구')
    const industry = await screen.findByLabelText('지원 업종')
    await screen.findByRole('option', { name: '종로구' })
    await screen.findByRole('option', { name: '커피·음료' })
    expect(
      within(industry)
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual(expect.arrayContaining(['CS100010', 'CS100008']))
    const originalCenter = (map.latest?.data as { center: number[] } | undefined)?.center
    expect(originalCenter).toBeDefined()
    await user.selectOptions(district, '11110')
    expect(api.getAdministrativeDongs).toHaveBeenCalledWith('11110', expect.any(AbortSignal))
    const dong = screen.getByLabelText('행정동')
    await screen.findByRole('option', { name: '청운효자동' })
    await user.selectOptions(dong, '11110515')
    await user.selectOptions(industry, 'CS100010')
    expect(dong).toHaveValue('11110515')
    expect(map.latest?.regions).toEqual([])
    expect(map.latest?.selectedRegionCode).toBe('')
    expect((map.latest?.data as { center: number[] } | undefined)?.center).toEqual(originalCenter)
    expect(JSON.stringify(map.latest)).not.toContain('1111051500')
    expect(fetchMock).not.toHaveBeenCalled()
    await user.selectOptions(dong, '11110530')
    expect(screen.getByRole('option', { name: '과거행정동 (과거 코드)' })).toBeInTheDocument()
    expect(screen.queryByText(/원천 코드|seoul-v1/)).not.toBeInTheDocument()
  })

  it('지도에서 확인한 H10과 업종을 그대로 보내고 BE 404를 분석 오류로 표시한다', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'NOT_FOUND', message: '요청한 경로가 없습니다.', details: [] },
          meta: { requestId: 'not-found' },
        }),
        { status: 404 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const originalMode = config.demoMode
    config.demoMode = false
    try {
      render(<DashboardUnderTest />)
      await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
      await screen.findByRole('option', { name: '커피·음료' })
      await user.click(screen.getByRole('button', { name: '지도 위치 분석' }))
      await screen.findByText('분석을 완료하지 못했어요')
      expect(fetchMock).toHaveBeenCalledWith(
        `${config.apiBaseUrl}/analyses`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ regionCode: '1111051500', industryCode: 'CS100010' }),
        }),
      )
      expect(screen.queryByText(/예시 분석/)).not.toBeInTheDocument()
    } finally {
      config.demoMode = originalMode
      vi.unstubAllGlobals()
    }
  })

  it('지도에서 확인한 위치와 서버 업종은 기존 빠른 분석 버튼으로 다시 요청할 수 있다', async () => {
    const user = userEvent.setup()
    const originalMode = config.demoMode
    config.demoMode = false
    const request = { regionCode: '1111051500', industryCode: 'CS100010' }
    const result = { ...createDemoAnalysis(defaultRequest), request, source: 'api' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)))
    vi.stubGlobal('fetch', fetchMock)
    try {
      render(<DashboardUnderTest />)
      await screen.findByRole('button', { name: '지도 위치 분석' })
      await user.click(screen.getByRole('button', { name: '지도 위치 분석' }))
      await screen.findByRole('button', { name: '분석 저장' })
      await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${config.apiBaseUrl}/analyses`,
        expect.objectContaining({ method: 'POST', body: JSON.stringify(request) }),
      )
    } finally {
      config.demoMode = originalMode
    }
  })

  it('지도 분석 결과를 본 뒤 자치구를 선택하면 이전 결과와 H10 경계를 현재 선택에서 분리한다', async () => {
    const user = userEvent.setup()
    const originalMode = config.demoMode
    config.demoMode = false
    const request = { regionCode: '1111051500', industryCode: 'CS100010' }
    const result = { ...createDemoAnalysis(defaultRequest), request, source: 'api' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(result))))
    try {
      render(<DashboardUnderTest />)
      await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
      await screen.findByRole('option', { name: '종로구' })
      await user.click(screen.getByRole('button', { name: '지도 위치 분석' }))
      await screen.findByRole('button', { name: '분석 저장' })
      expect(map.latest?.selectedRegionCode).toBe(request.regionCode)
      await user.selectOptions(screen.getByLabelText('자치구'), '11110')
      expect(screen.getByText(/검색 조건이 변경되었어요/)).toBeInTheDocument()
      expect(map.latest?.selectedRegionCode).toBe('')
      expect((map.latest?.data as { boundary: unknown[] } | undefined)?.boundary).toEqual([])
      expect((map.latest?.data as { places: unknown[] } | undefined)?.places).toEqual([])
    } finally {
      config.demoMode = originalMode
    }
  })

  it('저장 결과를 재열어 업종을 변경하면 이전 결과로 표시한다', async () => {
    const user = userEvent.setup()
    const result = {
      ...createDemoAnalysis(defaultRequest),
      request: { regionCode: '1111051500', industryCode: 'CS100010' },
      source: 'api' as const,
    }
    render(
      <ReferenceDashboard
        state={{ status: 'success', result }}
        run={vi.fn()}
        saved={[result]}
        onSave={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await screen.findByRole('option', { name: '분식' })
    await user.selectOptions(screen.getByLabelText('지원 업종'), 'CS100008')
    expect(screen.getByText(/검색 조건이 변경되었어요/)).toBeInTheDocument()
    expect((map.latest?.data as { boundary: unknown[] } | undefined)?.boundary).toEqual([])
    expect((map.latest?.data as { places: unknown[] } | undefined)?.places).toEqual([])
  })
})
