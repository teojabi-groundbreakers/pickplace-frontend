import { useCallback, useEffect, useReducer } from 'react'
import { ApiError } from './api'
import { getGroups, getLocalities, getProvinces } from './nationwideRegions'
import type { RegionItem, RegionSelectionList } from './nationwideRegions'

type ListState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; items: RegionItem[] }
  | { status: 'error'; message: string; code: string | null; requestId: string | null }

type State = {
  provinces: ListState
  groups: ListState
  localities: ListState
  regionVersion: string | null
  codeSystem: 'MOIS_H10' | null
  provinceCode: string
  groupCode: string
  localityCode: string
  notice: string | null
  selectionRevision: number
  provinceAttempt: number
  groupAttempt: number
  localityAttempt: number
  allowAutoSelect: boolean
}

type Scope = { code: string; version: string; attempt: number }
type Action =
  | { type: 'province-success'; attempt: number; result: RegionSelectionList }
  | { type: 'province-error'; attempt: number; error: unknown }
  | { type: 'groups-success'; scope: Scope; result: RegionSelectionList }
  | { type: 'groups-error'; scope: Scope; error: unknown }
  | { type: 'localities-success'; scope: Scope; result: RegionSelectionList }
  | { type: 'localities-error'; scope: Scope; error: unknown }
  | { type: 'select-province'; code: string }
  | { type: 'select-group'; code: string }
  | { type: 'select-locality'; code: string }
  | { type: 'retry-provinces' | 'retry-groups' | 'retry-localities' | 'dismiss-notice' }

const initialState: State = {
  provinces: { status: 'loading' },
  groups: { status: 'idle' },
  localities: { status: 'idle' },
  regionVersion: null,
  codeSystem: null,
  provinceCode: '',
  groupCode: '',
  localityCode: '',
  notice: null,
  selectionRevision: 0,
  provinceAttempt: 0,
  groupAttempt: 0,
  localityAttempt: 0,
  allowAutoSelect: true,
}

function errorState(error: unknown): ListState {
  let message = error instanceof Error ? error.message : '지역 목록을 불러오지 못했어요.'
  if (error instanceof ApiError && error.status === 503) {
    if (error.code === 'REFERENCE_DATA_NOT_READY') {
      message = '지역 기준정보가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.'
    } else if (error.code === 'DATA_SERVICE_UNAVAILABLE') {
      message = '지역 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
    }
  }
  return {
    status: 'error',
    message,
    code: error instanceof ApiError ? error.code : null,
    requestId: error instanceof ApiError ? (error.requestId ?? null) : null,
  }
}

function resetForVersionConflict(state: State): State {
  return {
    ...state,
    provinces: { status: 'loading' },
    groups: { status: 'idle' },
    localities: { status: 'idle' },
    regionVersion: null,
    codeSystem: null,
    provinceCode: '',
    groupCode: '',
    localityCode: '',
    notice: '지역 정보가 갱신되었습니다. 시·도부터 다시 선택해 주세요.',
    selectionRevision: state.selectionRevision + 1,
    provinceAttempt: state.provinceAttempt + 1,
    allowAutoSelect: false,
  }
}

function matchesScope(state: State, scope: Scope, level: 'groups' | 'localities') {
  return (
    state.regionVersion === scope.version &&
    (level === 'groups'
      ? state.provinceCode === scope.code && state.groupAttempt === scope.attempt
      : state.groupCode === scope.code && state.localityAttempt === scope.attempt)
  )
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'province-success':
      if (action.attempt !== state.provinceAttempt) return state
      return {
        ...state,
        provinces: { status: 'success', items: action.result.items },
        regionVersion: action.result.regionVersion,
        codeSystem: action.result.codeSystem,
      }
    case 'province-error':
      if (action.attempt !== state.provinceAttempt) return state
      return { ...state, provinces: errorState(action.error) }
    case 'groups-success': {
      if (!matchesScope(state, action.scope, 'groups')) return state
      if (action.result.regionVersion !== action.scope.version) {
        return {
          ...state,
          groups: errorState(
            new ApiError('지역 목록의 버전이 일치하지 않습니다.', 200, 'INVALID_RESPONSE'),
          ),
        }
      }
      const automatic = state.allowAutoSelect
        ? action.result.items.filter((item) => item.autoSelect)
        : []
      if (automatic.length > 1) {
        return {
          ...state,
          groups: errorState(
            new ApiError('지역 자동 선택 정보를 확인할 수 없어요.', 200, 'INVALID_RESPONSE'),
          ),
        }
      }
      const selected = automatic[0]
      return {
        ...state,
        groups: { status: 'success', items: action.result.items },
        groupCode: selected?.regionCode ?? '',
        localities: selected ? { status: 'loading' } : { status: 'idle' },
      }
    }
    case 'groups-error':
      if (!matchesScope(state, action.scope, 'groups')) return state
      if (
        action.error instanceof ApiError &&
        action.error.status === 409 &&
        action.error.code === 'REGION_VERSION_CONFLICT'
      ) {
        return resetForVersionConflict(state)
      }
      if (
        action.error instanceof ApiError &&
        action.error.status === 404 &&
        action.error.code === 'REGION_NOT_FOUND'
      ) {
        return {
          ...resetForVersionConflict(state),
          notice: '선택한 시·도를 다시 확인해 주세요.',
        }
      }
      return { ...state, groups: errorState(action.error) }
    case 'localities-success':
      if (!matchesScope(state, action.scope, 'localities')) return state
      if (action.result.regionVersion !== action.scope.version) {
        return {
          ...state,
          localities: errorState(
            new ApiError('지역 목록의 버전이 일치하지 않습니다.', 200, 'INVALID_RESPONSE'),
          ),
        }
      }
      return { ...state, localities: { status: 'success', items: action.result.items } }
    case 'localities-error':
      if (!matchesScope(state, action.scope, 'localities')) return state
      if (
        action.error instanceof ApiError &&
        action.error.status === 409 &&
        action.error.code === 'REGION_VERSION_CONFLICT'
      ) {
        return resetForVersionConflict(state)
      }
      if (
        action.error instanceof ApiError &&
        action.error.status === 404 &&
        action.error.code === 'REGION_NOT_FOUND'
      ) {
        return {
          ...state,
          groups: { status: 'loading' },
          localities: { status: 'idle' },
          groupCode: '',
          localityCode: '',
          notice: '선택한 지역을 다시 확인해 주세요.',
          selectionRevision: state.selectionRevision + 1,
          groupAttempt: state.groupAttempt + 1,
          allowAutoSelect: false,
        }
      }
      return { ...state, localities: errorState(action.error) }
    case 'select-province':
      if (
        action.code &&
        (state.provinces.status !== 'success' ||
          !state.provinces.items.some((item) => item.regionCode === action.code))
      )
        return state
      if (action.code === state.provinceCode) return state
      return {
        ...state,
        provinceCode: action.code,
        groupCode: '',
        localityCode: '',
        groups: action.code ? { status: 'loading' } : { status: 'idle' },
        localities: { status: 'idle' },
        notice: null,
        allowAutoSelect: true,
        selectionRevision: state.selectionRevision + 1,
        groupAttempt: state.groupAttempt + 1,
      }
    case 'select-group':
      if (
        action.code &&
        (state.groups.status !== 'success' ||
          !state.groups.items.some((item) => item.regionCode === action.code))
      )
        return state
      if (action.code === state.groupCode) return state
      return {
        ...state,
        groupCode: action.code,
        localityCode: '',
        localities: action.code ? { status: 'loading' } : { status: 'idle' },
        notice: null,
        selectionRevision: state.selectionRevision + 1,
        localityAttempt: state.localityAttempt + 1,
      }
    case 'select-locality':
      if (
        action.code &&
        (state.localities.status !== 'success' ||
          !state.localities.items.some((item) => item.regionCode === action.code))
      )
        return state
      if (action.code === state.localityCode) return state
      return { ...state, localityCode: action.code, selectionRevision: state.selectionRevision + 1 }
    case 'retry-provinces':
      return {
        ...state,
        provinces: { status: 'loading' },
        groups: { status: 'idle' },
        localities: { status: 'idle' },
        regionVersion: null,
        codeSystem: null,
        provinceCode: '',
        groupCode: '',
        localityCode: '',
        provinceAttempt: state.provinceAttempt + 1,
        selectionRevision: state.selectionRevision + 1,
        allowAutoSelect: false,
      }
    case 'retry-groups':
      if (!state.provinceCode) return state
      return {
        ...state,
        groups: { status: 'loading' },
        groupCode: '',
        localityCode: '',
        localities: { status: 'idle' },
        groupAttempt: state.groupAttempt + 1,
        selectionRevision: state.selectionRevision + 1,
      }
    case 'retry-localities':
      if (!state.groupCode) return state
      return {
        ...state,
        localities: { status: 'loading' },
        localityCode: '',
        localityAttempt: state.localityAttempt + 1,
        selectionRevision: state.selectionRevision + 1,
      }
    case 'dismiss-notice':
      return { ...state, notice: null }
  }
}

/** Proposed H10 list contract; it is not wired to the default Seoul flow. */
export function useNationwideRegions() {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const controller = new AbortController()
    const attempt = state.provinceAttempt
    getProvinces(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) dispatch({ type: 'province-success', attempt, result })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'province-error', attempt, error })
      })
    return () => controller.abort()
  }, [state.provinceAttempt])

  useEffect(() => {
    if (!state.provinceCode || !state.regionVersion) return
    const controller = new AbortController()
    const scope = {
      code: state.provinceCode,
      version: state.regionVersion,
      attempt: state.groupAttempt,
    }
    getGroups(scope.code, scope.version, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) dispatch({ type: 'groups-success', scope, result })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'groups-error', scope, error })
      })
    return () => controller.abort()
  }, [state.provinceCode, state.regionVersion, state.groupAttempt])

  useEffect(() => {
    if (!state.groupCode || !state.regionVersion) return
    const controller = new AbortController()
    const scope = {
      code: state.groupCode,
      version: state.regionVersion,
      attempt: state.localityAttempt,
    }
    getLocalities(scope.code, scope.version, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) dispatch({ type: 'localities-success', scope, result })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'localities-error', scope, error })
      })
    return () => controller.abort()
  }, [state.groupCode, state.regionVersion, state.localityAttempt])

  const selectProvince = useCallback(
    (code: string) => dispatch({ type: 'select-province', code }),
    [],
  )
  const selectGroup = useCallback((code: string) => dispatch({ type: 'select-group', code }), [])
  const selectLocality = useCallback(
    (code: string) => dispatch({ type: 'select-locality', code }),
    [],
  )
  const retryProvinces = useCallback(() => dispatch({ type: 'retry-provinces' }), [])
  const retryGroups = useCallback(() => dispatch({ type: 'retry-groups' }), [])
  const retryLocalities = useCallback(() => dispatch({ type: 'retry-localities' }), [])
  const dismissNotice = useCallback(() => dispatch({ type: 'dismiss-notice' }), [])

  return {
    ...state,
    selectProvince,
    selectGroup,
    selectLocality,
    retryProvinces,
    retryGroups,
    retryLocalities,
    dismissNotice,
  }
}
