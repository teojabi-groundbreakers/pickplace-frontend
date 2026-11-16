import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapRendererProps } from '../types/map'
import { NationwideReferenceDashboard } from '../pages/NationwideReferenceDashboard'

const mocks = vi.hoisted(() => ({
  getProvinces: vi.fn(),
  getGroups: vi.fn(),
  getLocalities: vi.fn(),
  getBusinessTypes: vi.fn(),
  locate: vi.fn(),
  locateGroup: vi.fn(),
  lookup: vi.fn(),
  boundary: vi.fn(),
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
  ReferenceLocationError: class extends Error {},
}))
vi.mock('../lib/regionLookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionLookup')>()),
  lookupAdministrativeRegion: mocks.lookup,
}))
vi.mock('../lib/regionBoundary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionBoundary')>()),
  getRegionBoundary: mocks.boundary,
}))
vi.mock('../components/KakaoMap', () => ({
  KakaoMap: ({ onPointSelect }: MapRendererProps) => (
    <button
      type="button"
      onClick={() => onPointSelect?.([37.3, 127])}
    >
      지도 우클릭
    </button>
  ),
}))
vi.mock('../components/AnalysisPanel', () => ({ AnalysisPanel: () => null }))

const province = {
  regionCode: '4100000000',
  regionName: '경기도',
  selectionLevel: 'PROVINCE',
  parentCode: null,
  autoSelect: false,
}
const group = {
  regionCode: '4111100000',
  regionName: '수원시 장안구',
  selectionLevel: 'GROUP',
  parentCode: province.regionCode,
  autoSelect: false,
}
const locality = {
  regionCode: '4111151000',
  regionName: '파장동',
  selectionLevel: 'LOCALITY',
  parentCode: group.regionCode,
  autoSelect: false,
}
const region = {
  region_type: 'H',
  code: locality.regionCode,
  address_name: '경기도 수원시 장안구 파장동',
  region_1depth_name: '경기도',
  region_2depth_name: '수원시',
  region_3depth_name: '파장동',
}

function list(items: unknown[]) {
  return {
    items,
    requestId: 'request',
    codeSystem: 'MOIS_H10',
    sourceReferenceOn: null,
    sourceFileVersion: '20261026',
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getProvinces.mockResolvedValue(list([province]))
  mocks.getGroups.mockResolvedValue(list([group]))
  mocks.getLocalities.mockResolvedValue(list([locality]))
  mocks.getBusinessTypes.mockResolvedValue({ items: [], requestId: 'business' })
  mocks.locate.mockResolvedValue({ region, center: [37.3, 127], placeName: '파장동 주민센터' })
  mocks.locateGroup.mockResolvedValue({ region, center: [37.3, 127], placeName: '장안구청' })
  mocks.boundary.mockResolvedValue(null)
})

describe('전국 화면의 실제 지도 조회 연결', () => {
  it('선택 위치를 표시한 뒤 우클릭한 조회가 변경된 컨텍스트에 의해 취소되지 않는다', async () => {
    const user = userEvent.setup()
    let resolveLookup!: (value: typeof region) => void
    mocks.lookup.mockReturnValueOnce(
      new Promise<typeof region>((resolve) => {
        resolveLookup = resolve
      }),
    )
    render(
      <NationwideReferenceDashboard
        state={{ status: 'idle' }}
        run={vi.fn()}
        saved={[]}
        onSave={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(await screen.findByLabelText('시·도'), province.regionCode)
    await user.selectOptions(await screen.findByLabelText('시·군·구'), group.regionCode)
    await user.selectOptions(await screen.findByLabelText('읍·면·행정동'), locality.regionCode)
    await waitFor(() => expect(mocks.locate).toHaveBeenCalledTimes(1))
    await screen.findByText(/파장동 주민센터 주변/)
    await user.click(screen.getByRole('button', { name: '지도 우클릭' }))
    await waitFor(() => expect(mocks.lookup).toHaveBeenCalledTimes(1))
    const signal = mocks.lookup.mock.calls[0][2] as AbortSignal
    expect(signal.aborted).toBe(false)
    await act(async () => resolveLookup(region))
    expect(await screen.findByText(region.address_name)).toBeInTheDocument()
    expect(signal.aborted).toBe(false)
  })
})
