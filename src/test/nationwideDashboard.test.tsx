import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ApiError } from '../lib/api'
import type { RegionItem, RegionSelectionList } from '../lib/nationwideRegions'
import { createDemoAnalysis, defaultRequest } from '../data/demo'
import type { AnalysisState } from '../lib/useAnalysis'
import type { MapViewData } from '../types/map'
import { NationwideReferenceDashboard } from '../pages/NationwideReferenceDashboard'

const mocks = vi.hoisted(() => ({
  getProvinces: vi.fn(),
  getGroups: vi.fn(),
  getLocalities: vi.fn(),
  getBusinessTypes: vi.fn(),
  locate: vi.fn(),
  locateGroup: vi.fn(),
}))

vi.mock('../lib/nationwideRegions', () => ({
  getProvinces: mocks.getProvinces,
  getGroups: mocks.getGroups,
  getLocalities: mocks.getLocalities,
}))
vi.mock('../lib/backendReference', () => ({ getBusinessTypes: mocks.getBusinessTypes }))
vi.mock('../lib/locateReferenceDong', () => ({
  locateNationwideReferenceDong: mocks.locate,
  locateNationwideReferenceGroup: mocks.locateGroup,
  ReferenceLocationError: class extends Error {
    code = 'NOT_FOUND'
  },
}))
vi.mock('../components/AreaMap', () => ({
  AreaMap: ({
    children,
    data,
    selectedRegionCode,
    analysisUnavailableMessage,
    preserveViewport,
    onExploreRegion,
  }: {
    children: ReactNode
    data: MapViewData
    selectedRegionCode: string
    analysisUnavailableMessage?: string
    preserveViewport?: boolean
    onExploreRegion: (region: {
      code: string
      name: string
      fullName: string
      center: [number, number]
    }) => void
  }) => (
    <div>
      <p data-testid="map-region">{selectedRegionCode}</p>
      <p data-testid="map-name">{data.regionName}</p>
      <p data-testid="map-boundary">{data.boundary.length}</p>
      <p data-testid="map-places">{data.places.length}</p>
      <p data-testid="map-analysis-message">{analysisUnavailableMessage}</p>
      <p data-testid="map-preserved">{String(preserveViewport)}</p>
      <button
        onClick={() =>
          onExploreRegion({
            code: '4111151000',
            name: '파장동',
            fullName: '파장동',
            center: [37.3, 127],
          })
        }
      >
        지도 위치 둘러보기
      </button>
      {children}
    </div>
  ),
}))
vi.mock('../components/AnalysisPanel', () => ({
  AnalysisPanel: ({ state }: { state: AnalysisState }) => (
    <div data-testid="analysis-status">{state.status}</div>
  ),
}))

const province: RegionItem = {
  regionCode: '4100000000',
  regionName: '경기도',
  selectionLevel: 'PROVINCE',
  parentCode: null,
  autoSelect: false,
}
const group: RegionItem = {
  regionCode: '4111100000',
  regionName: '수원시 장안구',
  selectionLevel: 'GROUP',
  parentCode: province.regionCode,
  autoSelect: false,
}
const locality: RegionItem = {
  regionCode: '4111151000',
  regionName: '파장동',
  selectionLevel: 'LOCALITY',
  parentCode: group.regionCode,
  autoSelect: false,
}

function list(items: RegionItem[]): RegionSelectionList {
  return {
    items,
    requestId: 'test-request',
    codeSystem: 'MOIS_H10',
    sourceReferenceOn: null,
    sourceFileVersion: '20261026',
  }
}

const found = {
  region: {
    region_type: 'H',
    code: locality.regionCode,
    address_name: '경기도 수원시 장안구 파장동',
    region_1depth_name: '경기도',
    region_2depth_name: '수원시',
    region_3depth_name: '파장동',
  },
  center: [37.3, 127.0],
  placeName: '파장동 행정복지센터',
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getProvinces.mockResolvedValue(list([province]))
  mocks.getGroups.mockResolvedValue(list([group]))
  mocks.getLocalities.mockResolvedValue(list([locality]))
  mocks.getBusinessTypes.mockResolvedValue({
    items: [{ businessTypeCode: 'CS100010', businessTypeName: '커피', supported: true }],
    requestId: 'business-request',
  })
  mocks.locate.mockResolvedValue(found)
  mocks.locateGroup.mockResolvedValue(found)
})

function renderDashboard(state: AnalysisState = { status: 'idle' }) {
  const run = vi.fn(async () => {})
  return {
    run,
    ...render(
      <NationwideReferenceDashboard
        state={state}
        run={run}
        saved={[]}
        onSave={() => {}}
      />,
    ),
  }
}

describe('기존 화면의 전국 지역 선택', () => {
  it('검증된 그룹 하위 H10으로 그룹 위치를 찾아 지도를 이동한다', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)

    await waitFor(() => expect(screen.getByTestId('map-name')).toHaveTextContent('파장동'))
    expect(mocks.locateGroup).toHaveBeenCalledWith(
      province.regionName,
      group.regionName,
      [locality.regionCode],
      expect.any(String),
      expect.any(AbortSignal),
    )
    expect(screen.getByTestId('map-region')).toBeEmptyDOMElement()
    expect(screen.getByTestId('map-preserved')).toHaveTextContent('false')
  })

  it('하위 목록이 비어 있으면 그룹 위치를 추정하지 않는다', async () => {
    const user = userEvent.setup()
    mocks.getLocalities.mockResolvedValue(list([]))
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)
    await screen.findByText('읍·면·행정동 목록이 비어 있어요.')
    expect(mocks.locateGroup).not.toHaveBeenCalled()
    expect(screen.getByTestId('map-preserved')).toHaveTextContent('true')
  })

  it('그룹 위치 조회 중 행정동 선택 시 이전 요청을 취소하고 늦은 결과를 무시한다', async () => {
    const user = userEvent.setup()
    let resolveGroup!: (value: typeof found) => void
    mocks.locateGroup.mockReturnValueOnce(
      new Promise<typeof found>((resolve) => {
        resolveGroup = resolve
      }),
    )
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)
    await waitFor(() => expect(mocks.locateGroup).toHaveBeenCalledTimes(1))
    const signal = mocks.locateGroup.mock.calls[0][4] as AbortSignal
    await user.selectOptions(await screen.findByLabelText('읍·면·행정동'), locality.regionCode)
    expect(signal.aborted).toBe(true)
    await waitFor(() =>
      expect(screen.getByTestId('map-region')).toHaveTextContent(locality.regionCode),
    )
    await act(async () => resolveGroup({ ...found, placeName: '늦은 이전 결과' }))
    expect(screen.getByTestId('map-name')).not.toHaveTextContent('늦은 이전 결과')
  })

  it('현재 선택을 다시 지정해도 진행 중인 위치 조회를 중단하지 않는다', async () => {
    const user = userEvent.setup()
    let resolveGroup!: (value: typeof found) => void
    mocks.locateGroup.mockReturnValueOnce(
      new Promise<typeof found>((resolve) => {
        resolveGroup = resolve
      }),
    )
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)
    await waitFor(() => expect(mocks.locateGroup).toHaveBeenCalledTimes(1))
    const signal = mocks.locateGroup.mock.calls[0][4] as AbortSignal

    fireEvent.change(screen.getByLabelText('시·도'), { target: { value: province.regionCode } })
    fireEvent.change(screen.getByLabelText('시·군·구'), { target: { value: group.regionCode } })
    expect(signal.aborted).toBe(false)
    await act(async () => resolveGroup(found))
    expect(screen.getByTestId('map-name')).toHaveTextContent('파장동')
  })

  it('그룹 위치 대기 중 지도의 둘러보기 위치를 선택하면 지도 이동을 허용한다', async () => {
    const user = userEvent.setup()
    mocks.locateGroup.mockReturnValueOnce(new Promise(() => {}))
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)
    await waitFor(() => expect(mocks.locateGroup).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('map-preserved')).toHaveTextContent('true')
    await user.click(screen.getByRole('button', { name: '지도 위치 둘러보기' }))
    expect(screen.getByTestId('map-preserved')).toHaveTextContent('false')
    expect(screen.getByTestId('map-name')).toHaveTextContent('파장동')
  })

  it('검색에서 같은 그룹을 다시 선택하면 이전 행정동을 해제한다', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)
    await user.selectOptions(await screen.findByLabelText('읍·면·행정동'), locality.regionCode)
    await waitFor(() =>
      expect(screen.getByTestId('map-region')).toHaveTextContent(locality.regionCode),
    )

    await user.type(screen.getByRole('combobox', { name: '지역 검색' }), group.regionName)
    await user.click(screen.getByRole('button', { name: group.regionName }))
    expect(screen.getByLabelText('읍·면·행정동')).toHaveValue('')
    expect(screen.getByTestId('map-region')).toBeEmptyDOMElement()
  })

  it('3단계 목록에 부모 H10만 전달하고 검증된 위치로 지도를 이동한다', async () => {
    const user = userEvent.setup()
    const { run } = renderDashboard()
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)
    await user.selectOptions(await screen.findByLabelText('읍·면·행정동'), locality.regionCode)

    await waitFor(() =>
      expect(screen.getByTestId('map-region')).toHaveTextContent(locality.regionCode),
    )
    expect(mocks.getGroups).toHaveBeenCalledWith(province.regionCode, expect.any(AbortSignal))
    expect(mocks.getLocalities).toHaveBeenCalledWith(group.regionCode, expect.any(AbortSignal))
    expect(mocks.locate).toHaveBeenCalledWith(
      province.regionName,
      group.regionName,
      locality.regionName,
      locality.regionCode,
      expect.any(String),
      expect.any(AbortSignal),
    )
    expect(screen.getByTestId('map-name')).toHaveTextContent('파장동')
    expect(screen.getByTestId('map-analysis-message')).toHaveTextContent('아직 준비되지')
    expect(screen.getByRole('button', { name: '상권 분석하기' })).toBeDisabled()
    expect(run).not.toHaveBeenCalled()
  })

  it('선택한 시·도가 유효하지 않으면 기존 분석·지도 결과를 지우고 재선택을 안내한다', async () => {
    const user = userEvent.setup()
    const saved = createDemoAnalysis(defaultRequest)
    mocks.getGroups.mockRejectedValueOnce(new ApiError('not found', 404, 'REGION_NOT_FOUND'))
    const { rerender, run } = renderDashboard({ status: 'success', result: saved })
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)

    await screen.findByText('선택한 시·도를 다시 확인해 주세요.')
    expect(screen.getByLabelText('시·도')).toHaveValue('')
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('idle')
    expect(screen.getByTestId('map-region')).toBeEmptyDOMElement()
    expect(screen.getByTestId('map-boundary')).toHaveTextContent('0')
    expect(screen.getByTestId('map-places')).toHaveTextContent('0')

    rerender(
      <NationwideReferenceDashboard
        state={{ status: 'success', result: saved }}
        run={run}
        saved={[]}
        onSave={() => {}}
      />,
    )
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('idle')
    expect(screen.getByTestId('map-places')).toHaveTextContent('0')
  })

  it('선택을 바꾸면 이전 위치 요청을 취소하고 늦은 결과를 사용하지 않는다', async () => {
    const user = userEvent.setup()
    let resolveLocation!: (value: typeof found) => void
    mocks.getProvinces.mockResolvedValue(
      list([
        province,
        {
          regionCode: '3600000000',
          regionName: '세종특별자치시',
          selectionLevel: 'PROVINCE',
          parentCode: null,
          autoSelect: false,
        },
      ]),
    )
    mocks.locate.mockReturnValueOnce(
      new Promise<typeof found>((resolve) => {
        resolveLocation = resolve
      }),
    )
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)
    await user.selectOptions(await screen.findByLabelText('읍·면·행정동'), locality.regionCode)
    await waitFor(() => expect(mocks.locate).toHaveBeenCalledTimes(1))
    const signal = mocks.locate.mock.calls[0][5] as AbortSignal

    await user.selectOptions(screen.getByLabelText('시·도'), '3600000000')
    expect(signal.aborted).toBe(true)
    await act(async () => resolveLocation(found))
    expect(screen.getByTestId('map-region')).toBeEmptyDOMElement()
    expect(screen.getByTestId('map-name')).not.toHaveTextContent('파장동')
  })

  it('지역 기준정보가 준비되지 않으면 기존 서울 목록으로 대체하지 않는다', async () => {
    mocks.getProvinces.mockRejectedValueOnce(new ApiError('error', 503, 'REFERENCE_DATA_NOT_READY'))
    renderDashboard()
    await screen.findByText('지역 기준정보가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.')
    expect(mocks.getGroups).not.toHaveBeenCalled()
    expect(screen.queryByText('서울특별시')).not.toBeInTheDocument()
  })

  it('이전 분석 오류를 다시 표시하거나 요청을 재시도하지 않는다', async () => {
    const { run } = renderDashboard({
      status: 'error',
      request: { regionCode: locality.regionCode, industryCode: 'CS100010' },
      message: '이전 분석 실패',
    })
    await screen.findByRole('button', { name: '업종·지역 조건' })
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('idle')
    expect(screen.queryByRole('button', { name: '다시 시도하기' })).not.toBeInTheDocument()
    expect(run).not.toHaveBeenCalled()
  })
})
