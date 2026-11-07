import type { ReactNode } from 'react'
import { config } from '../lib/config'
import { useAnalysis } from '../lib/useAnalysis'
import { createDemoAnalysis, defaultRequest } from '../data/demo'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReferenceDashboard } from '../pages/ReferenceDashboard'

const api = vi.hoisted(() => ({
  getDistricts: vi.fn(),
  getAdministrativeDongs: vi.fn(),
  getBusinessTypes: vi.fn(),
}))
const location = vi.hoisted(() => ({
  locateReferenceDong: vi.fn(),
  locateReferenceDistrict: vi.fn(),
  mapReferenceCode: vi.fn(),
}))
const map = vi.hoisted(() => ({ latest: null as Record<string, unknown> | null }))

vi.mock('../lib/backendReference', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/backendReference')>()),
  ...api,
}))
vi.mock('../lib/locateReferenceDong', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/locateReferenceDong')>()),
  locateReferenceDong: location.locateReferenceDong,
  locateReferenceDistrict: location.locateReferenceDistrict,
}))
vi.mock('../lib/referenceCodeMapping', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/referenceCodeMapping')>()),
  mapReferenceCode: location.mapReferenceCode,
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
                fullName: '서울특별시 종로구 청운효자동',
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
  location.mapReferenceCode.mockImplementation((_district, dong) =>
    dong?.officialCodeStatus === 'LEGACY'
      ? { status: 'unavailable', reason: 'LEGACY' }
      : { status: 'available', officialCode: '1111051500', officialName: '청운효자동' },
  )
  location.locateReferenceDistrict.mockImplementation(() => new Promise(() => {}))
  location.locateReferenceDong.mockImplementation(() => new Promise(() => {}))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('실제 백엔드 기준정보 화면', () => {
  it('시도 선택을 초기화하면 하위 지역이 해제되고 검색으로 서울 지역을 다시 선택한다', async () => {
    const user = userEvent.setup()
    api.getAdministrativeDongs.mockImplementation((code: string) =>
      Promise.resolve(payload(code === '11110' ? dongs : [])),
    )
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))

    const city = screen.getByLabelText('시·도')
    const district = await screen.findByLabelText('시·군·구')
    const dong = screen.getByLabelText('행정동')
    expect(city).toHaveValue('11')
    expect(within(city).getByRole('option', { name: '서울특별시' })).toBeInTheDocument()
    await screen.findByRole('option', { name: '종로구' })
    await user.selectOptions(district, '11110')
    await screen.findByRole('option', { name: '청운효자동' })
    await user.selectOptions(dong, '11110515')
    expect(dong).toHaveValue('11110515')

    await user.selectOptions(city, '')
    expect(district).toHaveValue('')
    expect(dong).toHaveValue('')
    expect(district).toBeDisabled()
    expect(dong).toBeDisabled()

    await user.type(screen.getByRole('combobox', { name: '지역 검색' }), '청운효자동')
    await user.click(await screen.findByRole('button', { name: '종로구 청운효자동' }))
    expect(city).toHaveValue('11')
    expect(district).toHaveValue('11110')
    await waitFor(() => expect(dong).toHaveValue('11110515'))
  })

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
    expect(screen.getByRole('alert')).toHaveTextContent('위치를 확인하고 있어요')
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
    const district = await screen.findByLabelText('시·군·구')
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

  it('지도에서 서울 외 지역을 분석하면 시도를 잘못 표시하지 않고 같은 위치로 재분석한다', async () => {
    const user = userEvent.setup()
    const originalMode = config.demoMode
    config.demoMode = false
    const request = { regionCode: '9999999999', industryCode: 'CS100010' }
    const result = { ...createDemoAnalysis(defaultRequest), request, source: 'api' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)))
    vi.stubGlobal('fetch', fetchMock)

    try {
      render(<DashboardUnderTest />)
      await screen.findByRole('button', { name: '지도 위치 분석' })
      const analysis = map.latest?.analysis as {
        onAnalyze: (
          region: { code: string; name: string; fullName: string; center: [number, number] },
          industryCode: string,
        ) => void
      }
      await act(async () => {
        analysis.onAnalyze(
          {
            code: request.regionCode,
            name: '가상동',
            fullName: '경기도 수원시 장안구 가상동',
            center: [37.29, 127.01],
          },
          request.industryCode,
        )
      })
      await screen.findByRole('button', { name: '분석 저장' })
      await user.click(screen.getByRole('button', { name: '업종·지역 조건' }))
      expect(screen.getByLabelText('시·도')).toHaveValue('')
      expect(screen.getByLabelText('시·군·구')).toBeDisabled()
      expect(screen.getByText('경기도 수원시 장안구 가상동')).toBeInTheDocument()
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
      await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
      expect(screen.getByText(/검색 조건이 변경되었어요/)).toBeInTheDocument()
      expect(map.latest?.selectedRegionCode).toBe('')
      expect((map.latest?.data as { boundary: unknown[] } | undefined)?.boundary).toEqual([])
      expect((map.latest?.data as { places: unknown[] } | undefined)?.places).toEqual([])
    } finally {
      config.demoMode = originalMode
    }
  })

  it('시도 선택 해제 시 기존 분석을 이전 결과로 분리하고 새 분석은 다시 표시한다', async () => {
    const user = userEvent.setup()
    const originalMode = config.demoMode
    config.demoMode = false
    const request = { regionCode: '1111051500', industryCode: 'CS100010' }
    const result = { ...createDemoAnalysis(defaultRequest), request, source: 'api' }
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(result))))
    vi.stubGlobal('fetch', fetchMock)

    try {
      render(<DashboardUnderTest />)
      await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
      await user.click(screen.getByRole('button', { name: '지도 위치 분석' }))
      await screen.findByRole('button', { name: '분석 저장' })
      expect(map.latest?.selectedRegionCode).toBe(request.regionCode)

      await user.selectOptions(screen.getByLabelText('시·도'), '')
      expect(screen.getByText(/검색 조건이 변경되었어요/)).toBeInTheDocument()
      expect(map.latest?.selectedRegionCode).toBe('')
      expect((map.latest?.data as { boundary: unknown[] } | undefined)?.boundary).toEqual([])
      expect((map.latest?.data as { places: unknown[] } | undefined)?.places).toEqual([])

      await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
      expect(screen.getByRole('alert')).toHaveTextContent('지역의 위치를 확인한 뒤 분석해 주세요.')
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('button', { name: '지도 위치 분석' }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      await waitFor(() =>
        expect(screen.queryByText(/검색 조건이 변경되었어요/)).not.toBeInTheDocument(),
      )
      expect(map.latest?.selectedRegionCode).toBe(request.regionCode)
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

  it('시도 선택 해제 후 저장한 분석을 다시 열면 해당 결과를 표시한다', async () => {
    const user = userEvent.setup()
    const result = {
      ...createDemoAnalysis(defaultRequest),
      request: { regionCode: '1111051500', industryCode: 'CS100010' },
      source: 'api' as const,
    }
    const savedState = { status: 'success' as const, result }
    const view = render(
      <ReferenceDashboard
        state={savedState}
        run={vi.fn()}
        saved={[result]}
        onSave={() => {}}
      />,
    )

    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·도'), '')
    expect(screen.getByText(/검색 조건이 변경되었어요/)).toBeInTheDocument()
    expect(map.latest?.selectedRegionCode).toBe('')

    view.rerender(
      <ReferenceDashboard
        state={{ status: 'success', result }}
        run={vi.fn()}
        saved={[result]}
        onSave={() => {}}
      />,
    )

    expect(screen.queryByText(/검색 조건이 변경되었어요/)).not.toBeInTheDocument()
    expect(map.latest?.selectedRegionCode).toBe(result.request.regionCode)
  })

  it('실제 역조회가 확인한 H 코드와 좌표로 이동하고 해당 H 코드를 분석에 사용한다', async () => {
    const user = userEvent.setup()
    const officialCode = '1111099900'
    const verified = {
      region: {
        region_type: 'H',
        code: officialCode,
        address_name: '서울특별시 종로구 청운효자동',
        region_1depth_name: '서울특별시',
        region_2depth_name: '종로구',
        region_3depth_name: '청운효자동',
      },
      center: [37.582, 126.971],
      placeName: '청운효자동 주민센터',
    }
    location.mapReferenceCode.mockReturnValue({
      status: 'available',
      officialCode,
      officialName: '청운효자동',
    })
    location.locateReferenceDong.mockResolvedValue(verified)
    const run = vi.fn().mockResolvedValue(undefined)
    render(
      <ReferenceDashboard
        state={{ status: 'idle' }}
        run={run}
        saved={[]}
        onSave={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await screen.findByRole('option', { name: '청운효자동' })
    await user.selectOptions(screen.getByLabelText('행정동'), '11110515')
    await waitFor(() =>
      expect(map.latest?.exploreRegion).toMatchObject({
        code: officialCode,
        center: verified.center,
      }),
    )
    expect(location.locateReferenceDong).toHaveBeenCalledWith(
      '종로구',
      '청운효자동',
      officialCode,
      '청운효자동',
      config.kakaoMapAppKey,
      expect.any(AbortSignal),
      '서울특별시',
    )
    await user.selectOptions(screen.getByLabelText('지원 업종'), 'CS100010')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(run).toHaveBeenCalledWith({ regionCode: officialCode, industryCode: 'CS100010' })
  })

  it('이미 선택된 구를 다시 검색해 선택해도 위치와 동 목록을 유지한다', async () => {
    const user = userEvent.setup()
    const verified = {
      region: {
        region_type: 'H',
        code: '1111051500',
        address_name: '서울특별시 종로구 청운효자동',
        region_1depth_name: '서울특별시',
        region_2depth_name: '종로구',
        region_3depth_name: '청운효자동',
      },
      center: [37.572, 126.979],
      placeName: '종로구청',
    }
    api.getAdministrativeDongs.mockImplementation((code: string) =>
      Promise.resolve(payload(code === '11110' ? dongs : [])),
    )
    location.locateReferenceDistrict.mockResolvedValue(verified)
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await screen.findByRole('option', { name: '청운효자동' })
    await waitFor(() =>
      expect(map.latest?.exploreRegion).toMatchObject({ center: verified.center }),
    )
    const input = screen.getByRole('combobox', { name: '지역 검색' })
    await user.type(input, '종로구')
    await waitFor(() =>
      expect(screen.queryByText('행정동 목록을 불러오고 있어요.')).not.toBeInTheDocument(),
    )
    const requestsBeforeSelection = api.getAdministrativeDongs.mock.calls.length
    await user.click(
      within(await screen.findByRole('listbox', { name: '지역 검색 결과' })).getByRole('button', {
        name: '종로구',
      }),
    )
    expect(screen.getByLabelText('시·군·구')).toHaveValue('11110')
    expect(screen.getByRole('option', { name: '청운효자동' })).toBeInTheDocument()
    expect(map.latest?.exploreRegion).toMatchObject({ center: verified.center })
    expect(location.locateReferenceDistrict).toHaveBeenCalledTimes(1)
    expect(api.getAdministrativeDongs).toHaveBeenCalledTimes(requestsBeforeSelection)
    expect(screen.queryByText('행정동 목록을 불러오고 있어요.')).not.toBeInTheDocument()
    expect(screen.queryByText('선택한 지역의 위치를 찾고 있어요.')).not.toBeInTheDocument()
  })

  it('이미 선택된 동을 다시 검색해 선택해도 위치와 동 선택을 유지한다', async () => {
    const user = userEvent.setup()
    const verified = {
      region: {
        region_type: 'H',
        code: '1111051500',
        address_name: '서울특별시 종로구 청운효자동',
        region_1depth_name: '서울특별시',
        region_2depth_name: '종로구',
        region_3depth_name: '청운효자동',
      },
      center: [37.582, 126.971],
      placeName: '청운효자동 주민센터',
    }
    api.getAdministrativeDongs.mockImplementation((code: string) =>
      Promise.resolve(payload(code === '11110' ? dongs : [])),
    )
    location.locateReferenceDong.mockResolvedValue(verified)
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await screen.findByRole('option', { name: '청운효자동' })
    await user.selectOptions(screen.getByLabelText('행정동'), '11110515')
    await waitFor(() =>
      expect(map.latest?.exploreRegion).toMatchObject({ center: verified.center }),
    )
    const input = screen.getByRole('combobox', { name: '지역 검색' })
    await user.type(input, '청운효자동')
    await user.click(await screen.findByRole('button', { name: '종로구 청운효자동' }))
    expect(screen.getByLabelText('시·군·구')).toHaveValue('11110')
    expect(screen.getByLabelText('행정동')).toHaveValue('11110515')
    expect(map.latest?.exploreRegion).toMatchObject({ center: verified.center })
    expect(location.locateReferenceDong).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('선택한 지역의 위치를 찾고 있어요.')).not.toBeInTheDocument()
  })

  it('동이 선택된 상태에서 같은 구를 검색하면 동 선택을 해제하고 구청으로 이동한다', async () => {
    const user = userEvent.setup()
    const region = {
      region_type: 'H',
      code: '1111051500',
      address_name: '서울특별시 종로구 청운효자동',
      region_1depth_name: '서울특별시',
      region_2depth_name: '종로구',
      region_3depth_name: '청운효자동',
    }
    location.locateReferenceDistrict.mockResolvedValue({
      region,
      center: [37.572, 126.979],
      placeName: '종로구청',
    })
    location.locateReferenceDong.mockResolvedValue({
      region,
      center: [37.582, 126.971],
      placeName: '청운효자동 주민센터',
    })
    api.getAdministrativeDongs.mockImplementation((code: string) =>
      Promise.resolve(payload(code === '11110' ? dongs : [])),
    )
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await screen.findByRole('option', { name: '청운효자동' })
    await user.selectOptions(screen.getByLabelText('행정동'), '11110515')
    await waitFor(() =>
      expect(map.latest?.exploreRegion).toMatchObject({ center: [37.582, 126.971] }),
    )
    await user.type(screen.getByRole('combobox', { name: '지역 검색' }), '종로구')
    await user.click(
      within(await screen.findByRole('listbox', { name: '지역 검색 결과' })).getByRole('button', {
        name: '종로구',
      }),
    )
    await waitFor(() =>
      expect(map.latest?.exploreRegion).toMatchObject({ center: [37.572, 126.979] }),
    )
    expect(screen.getByLabelText('시·군·구')).toHaveValue('11110')
    expect(screen.getByLabelText('행정동')).toHaveValue('')
    expect(screen.getByRole('option', { name: '청운효자동' })).toBeInTheDocument()
    expect(screen.queryByText('행정동 목록을 불러오고 있어요.')).not.toBeInTheDocument()
    expect(screen.queryByText('선택한 지역의 위치를 찾고 있어요.')).not.toBeInTheDocument()
  })

  it('자치구 선택은 검증된 구청 주변으로 이동하되 동 분석 위치로 취급하지 않는다', async () => {
    const user = userEvent.setup()
    const verified = {
      region: {
        region_type: 'H',
        code: '1111051500',
        address_name: '서울특별시 종로구 청운효자동',
        region_1depth_name: '서울특별시',
        region_2depth_name: '종로구',
        region_3depth_name: '청운효자동',
      },
      center: [37.572, 126.979],
      placeName: '종로구청',
    }
    location.locateReferenceDistrict.mockResolvedValue(verified)
    const run = vi.fn()
    render(
      <ReferenceDashboard
        state={{ status: 'idle' }}
        run={run}
        saved={[]}
        onSave={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await waitFor(() =>
      expect(map.latest?.exploreRegion).toMatchObject({ center: verified.center }),
    )
    await user.selectOptions(screen.getByLabelText('지원 업종'), 'CS100010')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(run).not.toHaveBeenCalled()
  })

  it('검증된 공식 대응이 없는 동에는 이름이나 8자리 코드를 이용해 좌표를 추정하지 않는다', async () => {
    const user = userEvent.setup()
    location.mapReferenceCode.mockReturnValue({ status: 'unavailable', reason: 'VERSION_MISMATCH' })
    const run = vi.fn()
    render(
      <ReferenceDashboard
        state={{ status: 'idle' }}
        run={run}
        saved={[]}
        onSave={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await screen.findByRole('option', { name: '청운효자동' })
    await user.selectOptions(screen.getByLabelText('행정동'), '11110515')
    await screen.findByRole('button', { name: '위치 다시 찾기' })
    expect(location.locateReferenceDong).not.toHaveBeenCalled()
    expect(map.latest?.exploreRegion).toBeNull()
    expect(run).not.toHaveBeenCalled()
  })

  it('위치 검색 실패에는 지도 위치를 임의로 바꾸지 않으며 재시도할 수 있다', async () => {
    const user = userEvent.setup()
    const verified = {
      region: {
        region_type: 'H',
        code: '1111051500',
        address_name: '서울특별시 종로구 청운효자동',
        region_1depth_name: '서울특별시',
        region_2depth_name: '종로구',
        region_3depth_name: '청운효자동',
      },
      center: [37.582, 126.971],
      placeName: '청운효자동 주민센터',
    }
    location.locateReferenceDong
      .mockRejectedValueOnce(new Error('위치를 확인하지 못했어요.'))
      .mockResolvedValueOnce(verified)
    const run = vi.fn()
    render(
      <ReferenceDashboard
        state={{ status: 'idle' }}
        run={run}
        saved={[]}
        onSave={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await screen.findByRole('option', { name: '청운효자동' })
    await user.selectOptions(screen.getByLabelText('행정동'), '11110515')
    await screen.findByRole('button', { name: '위치 다시 찾기' })
    expect(map.latest?.exploreRegion).toBeNull()
    await user.selectOptions(screen.getByLabelText('지원 업종'), 'CS100010')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(run).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '위치 다시 찾기' }))
    await waitFor(() =>
      expect(map.latest?.exploreRegion).toMatchObject({ center: verified.center }),
    )
    expect(location.locateReferenceDong).toHaveBeenCalledTimes(2)
  })

  it('위치 조회 중 지도 조작은 조회를 취소하고 늦은 좌표가 사용자 화면을 덮지 않는다', async () => {
    const user = userEvent.setup()
    let resolveLocation!: (value: unknown) => void
    location.locateReferenceDistrict.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLocation = resolve
        }),
    )
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    const previousCenter = (map.latest?.data as { center: number[] } | undefined)?.center
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await screen.findByText('선택한 지역의 위치를 찾고 있어요.')
    expect(map.latest?.preserveViewport).toBe(true)
    const signal = location.locateReferenceDistrict.mock.calls[0][2] as AbortSignal
    await user.click(screen.getByRole('button', { name: '지도 조작' }))
    expect(signal.aborted).toBe(true)
    expect(screen.getByText('지도 조작으로 위치 찾기를 중단했어요.')).toBeInTheDocument()
    expect(map.latest?.preserveViewport).toBe(true)
    await act(async () =>
      resolveLocation({
        region: {
          region_type: 'H',
          code: '1111051500',
          address_name: '서울특별시 종로구 청운효자동',
          region_1depth_name: '서울특별시',
          region_2depth_name: '종로구',
          region_3depth_name: '청운효자동',
        },
        center: [37.572, 126.979],
        placeName: '종로구청',
      }),
    )
    expect(map.latest?.exploreRegion).toBeNull()
    expect(map.latest?.preserveViewport).toBe(true)
    expect((map.latest?.data as { center: number[] } | undefined)?.center).toEqual(previousCenter)
  })

  it('행정동을 빠르게 바꾸면 이전 위치 조회를 취소하고 늦은 응답은 무시한다', async () => {
    const user = userEvent.setup()
    const second = { ...dongs[0], dongCode: '11110516', dongName: '다른동' }
    api.getAdministrativeDongs.mockResolvedValue(payload([dongs[0], second]))
    location.mapReferenceCode.mockImplementation((_district, dong) => ({
      status: 'available',
      officialCode: dong.dongCode === second.dongCode ? '1111051600' : '1111051500',
      officialName: dong.dongName,
    }))
    let resolveFirst!: (value: unknown) => void
    location.locateReferenceDong.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    location.locateReferenceDong.mockResolvedValueOnce({
      region: {
        region_type: 'H',
        code: '1111051600',
        address_name: '서울특별시 종로구 다른동',
        region_1depth_name: '서울특별시',
        region_2depth_name: '종로구',
        region_3depth_name: '다른동',
      },
      center: [37.59, 126.98],
      placeName: '다른동 주민센터',
    })
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11110')
    await screen.findByRole('option', { name: '청운효자동' })
    await user.selectOptions(screen.getByLabelText('행정동'), '11110515')
    const firstSignal = location.locateReferenceDong.mock.calls[0][5] as AbortSignal
    await user.selectOptions(screen.getByLabelText('행정동'), second.dongCode)
    expect(firstSignal.aborted).toBe(true)
    await waitFor(() => expect(map.latest?.exploreRegion).toMatchObject({ code: '1111051600' }))
    await act(async () =>
      resolveFirst({
        region: {
          region_type: 'H',
          code: '1111051500',
          address_name: '서울특별시 종로구 청운효자동',
          region_1depth_name: '서울특별시',
          region_2depth_name: '종로구',
          region_3depth_name: '청운효자동',
        },
        center: [37.58, 126.97],
        placeName: '청운효자동 주민센터',
      }),
    )
    expect(map.latest?.exploreRegion).toMatchObject({ code: '1111051600' })
  })

  it('구 목록 장애와 업종의 빈 결과를 각각 표시하며 재시도한다', async () => {
    const user = userEvent.setup()
    api.getDistricts.mockRejectedValueOnce(new Error('구 목록 오류'))
    api.getBusinessTypes.mockResolvedValueOnce(payload([]))
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    expect(await screen.findByText('구 목록 오류')).toBeInTheDocument()
    expect(await screen.findByText('지원 업종이 없어요.')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '종로구' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '커피·음료' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '자치구 다시 불러오기' }))
    expect(await screen.findByRole('option', { name: '종로구' })).toBeInTheDocument()
  })

  it('구를 빠르게 바꾸면 이전 동 요청을 취소하고 늦게 도착한 결과를 무시한다', async () => {
    const user = userEvent.setup()
    let resolveFirst!: (value: ReturnType<typeof payload<(typeof dongs)[number]>>) => void
    api.getAdministrativeDongs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    api.getAdministrativeDongs.mockResolvedValueOnce(
      payload([
        { ...dongs[0], dongCode: '11140515', dongName: '중구 행정동', districtCode: '11140' },
      ]),
    )
    render(<DashboardUnderTest />)
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    const district = await screen.findByLabelText('시·군·구')
    await screen.findByRole('option', { name: '종로구' })
    await user.selectOptions(district, '11110')
    const firstSignal = api.getAdministrativeDongs.mock.calls[0][1] as AbortSignal
    await user.selectOptions(district, '11140')
    expect(firstSignal.aborted).toBe(true)
    expect(await screen.findByRole('option', { name: '중구 행정동' })).toBeInTheDocument()
    await act(async () => resolveFirst(payload(dongs)))
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: '청운효자동' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('option', { name: '중구 행정동' })).toBeInTheDocument()
  })
})
