import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import type { RegionItem, RegionSelectionList } from '../lib/nationwideRegions'
import { useNationwideRegions } from '../lib/useNationwideRegions'

const api = vi.hoisted(() => ({
  getProvinces: vi.fn(),
  getGroups: vi.fn(),
  getLocalities: vi.fn(),
}))

vi.mock('../lib/nationwideRegions', () => api)

const version = 'selection-version-1'
const seoul: RegionItem = {
  regionCode: '1100000000',
  regionName: '서울특별시',
  selectionLevel: 'PROVINCE',
  parentCode: null,
  autoSelect: false,
}
const sejong: RegionItem = {
  regionCode: '3600000000',
  regionName: '세종특별자치시',
  selectionLevel: 'PROVINCE',
  parentCode: null,
  autoSelect: false,
}
const jongno: RegionItem = {
  regionCode: '1111000000',
  regionName: '종로구',
  selectionLevel: 'GROUP',
  parentCode: seoul.regionCode,
  autoSelect: false,
}
const sejongGroup: RegionItem = {
  regionCode: '3611000000',
  regionName: '세종특별자치시',
  selectionLevel: 'GROUP',
  parentCode: sejong.regionCode,
  autoSelect: true,
}
const dong: RegionItem = {
  regionCode: '1111051500',
  regionName: '청운효자동',
  selectionLevel: 'LOCALITY',
  parentCode: jongno.regionCode,
  autoSelect: false,
}

function list(items: RegionItem[], regionVersion = version): RegionSelectionList {
  return {
    items,
    regionVersion,
    codeSystem: 'MOIS_H10',
    sourceReferenceOn: null,
    sourceFileVersion: '20261026',
    requestId: 'test-request',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getProvinces.mockResolvedValue(list([seoul, sejong]))
  api.getGroups.mockResolvedValue(list([jongno]))
  api.getLocalities.mockResolvedValue(list([dong]))
})

describe('전국 H10 지역 선택 상태', () => {
  it('한 그룹만 있어도 자동 선택하지 않고 각 요청에 선택 버전을 전달한다', async () => {
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    expect(result.current.codeSystem).toBe('MOIS_H10')

    act(() => result.current.selectProvince(seoul.regionCode))
    await waitFor(() => expect(result.current.groups.status).toBe('success'))
    expect(result.current.groupCode).toBe('')
    expect(api.getLocalities).not.toHaveBeenCalled()
    expect(api.getGroups).toHaveBeenCalledWith(seoul.regionCode, version, expect.any(AbortSignal))

    act(() => result.current.selectGroup(jongno.regionCode))
    await waitFor(() => expect(result.current.localities.status).toBe('success'))
    expect(api.getLocalities).toHaveBeenCalledWith(
      jongno.regionCode,
      version,
      expect.any(AbortSignal),
    )
    const revision = result.current.selectionRevision
    act(() => result.current.selectLocality(dong.regionCode))
    expect(result.current.localityCode).toBe(dong.regionCode)
    expect(result.current.selectionRevision).toBeGreaterThan(revision)
  })

  it('서버가 명시적으로 autoSelect한 그룹만 선택한다', async () => {
    api.getGroups.mockResolvedValue(list([sejongGroup]))
    api.getLocalities.mockResolvedValue(list([]))
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    act(() => result.current.selectProvince(sejong.regionCode))
    await waitFor(() => expect(result.current.localities.status).toBe('success'))
    expect(result.current.groupCode).toBe(sejongGroup.regionCode)
    expect(result.current.localities).toEqual({ status: 'success', items: [] })
  })

  it('409에서는 모든 선택을 지우고 시·도를 한 번 다시 조회하며 자동 재선택하지 않는다', async () => {
    const reloaded = deferred<RegionSelectionList>()
    api.getProvinces
      .mockResolvedValueOnce(list([seoul, sejong]))
      .mockReturnValueOnce(reloaded.promise)
    api.getGroups.mockRejectedValue(new ApiError('version changed', 409, 'REGION_VERSION_CONFLICT'))
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    act(() => result.current.selectProvince(seoul.regionCode))
    await waitFor(() => expect(api.getProvinces).toHaveBeenCalledTimes(2))
    expect(result.current.regionVersion).toBeNull()
    expect(result.current.codeSystem).toBeNull()
    await act(async () => reloaded.resolve(list([seoul, sejong], 'selection-version-2')))
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    expect(result.current.regionVersion).toBe('selection-version-2')
    expect(result.current.codeSystem).toBe('MOIS_H10')
    expect(result.current.provinceCode).toBe('')
    expect(result.current.groupCode).toBe('')
    expect(result.current.localityCode).toBe('')
    expect(result.current.notice).toContain('시·도부터 다시 선택')
    expect(api.getGroups).toHaveBeenCalledTimes(1)
  })

  it('읍면동 조회에서 409가 나면 그룹 선택도 지우고 결과 초기화 신호를 발생시킨다', async () => {
    api.getLocalities.mockRejectedValue(
      new ApiError('version changed', 409, 'REGION_VERSION_CONFLICT'),
    )
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    act(() => result.current.selectProvince(seoul.regionCode))
    await waitFor(() => expect(result.current.groups.status).toBe('success'))
    const revision = result.current.selectionRevision
    act(() => result.current.selectGroup(jongno.regionCode))
    await waitFor(() => expect(api.getProvinces).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    expect(result.current.provinceCode).toBe('')
    expect(result.current.groupCode).toBe('')
    expect(result.current.localityCode).toBe('')
    expect(result.current.selectionRevision).toBeGreaterThan(revision)
    expect(result.current.notice).toContain('시·도부터 다시 선택')
    expect(api.getLocalities).toHaveBeenCalledTimes(1)
  })

  it('하위 선택을 바꾸면 이전 요청을 취소하고 늦은 응답을 사용하지 않는다', async () => {
    const old = deferred<RegionSelectionList>()
    api.getGroups.mockReturnValueOnce(old.promise).mockResolvedValueOnce(list([sejongGroup]))
    api.getLocalities.mockResolvedValue(list([]))
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    act(() => result.current.selectProvince(seoul.regionCode))
    await waitFor(() => expect(api.getGroups).toHaveBeenCalledTimes(1))
    const signal = api.getGroups.mock.calls[0][2] as AbortSignal
    act(() => result.current.selectProvince(sejong.regionCode))
    await waitFor(() => expect(result.current.groupCode).toBe(sejongGroup.regionCode))
    expect(signal.aborted).toBe(true)
    await act(async () => old.resolve(list([jongno])))
    expect(result.current.provinceCode).toBe(sejong.regionCode)
    expect(result.current.groupCode).toBe(sejongGroup.regionCode)
  })

  it('404에서는 현재 하위 선택을 지우고 부모 목록을 재확인한다', async () => {
    api.getLocalities.mockRejectedValueOnce(new ApiError('not found', 404, 'REGION_NOT_FOUND'))
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    act(() => result.current.selectProvince(seoul.regionCode))
    await waitFor(() => expect(result.current.groups.status).toBe('success'))
    act(() => result.current.selectGroup(jongno.regionCode))
    await waitFor(() => expect(api.getGroups).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.groups.status).toBe('success'))
    expect(result.current.provinceCode).toBe(seoul.regionCode)
    expect(result.current.groupCode).toBe('')
    expect(result.current.localities.status).toBe('idle')
    expect(result.current.notice).toContain('다시 확인')
  })

  it('503은 오류로 보존하고 서울 목록이나 빈 목록으로 대체하지 않는다', async () => {
    api.getGroups.mockRejectedValue(
      new ApiError('준비 중', 503, 'REFERENCE_DATA_NOT_READY', 'request-1'),
    )
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    act(() => result.current.selectProvince(seoul.regionCode))
    await waitFor(() => expect(result.current.groups.status).toBe('error'))
    expect(result.current.groups).toMatchObject({
      code: 'REFERENCE_DATA_NOT_READY',
      requestId: 'request-1',
      message: '지역 기준정보가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.',
    })
    expect(result.current.localities.status).toBe('idle')
  })

  it('데이터 서비스 장애는 기준정보 미준비와 구분한다', async () => {
    api.getGroups.mockRejectedValue(
      new ApiError('서버가 요청을 처리하지 못했습니다.', 503, 'DATA_SERVICE_UNAVAILABLE'),
    )
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    act(() => result.current.selectProvince(seoul.regionCode))
    await waitFor(() => expect(result.current.groups.status).toBe('error'))
    expect(result.current.groups).toMatchObject({
      code: 'DATA_SERVICE_UNAVAILABLE',
      message: '지역 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    })
  })

  it('요청과 다른 버전의 성공 응답을 선택에 사용하지 않는다', async () => {
    api.getGroups.mockResolvedValue(list([jongno], 'different-version'))
    const { result } = renderHook(() => useNationwideRegions())
    await waitFor(() => expect(result.current.provinces.status).toBe('success'))
    act(() => result.current.selectProvince(seoul.regionCode))
    await waitFor(() => expect(result.current.groups.status).toBe('error'))
    expect(result.current.groups).toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(result.current.groupCode).toBe('')
  })
})
