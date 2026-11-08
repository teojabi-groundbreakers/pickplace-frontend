import { ApiError, requestFullEnvelopeJson } from './api'
import { isAdministrativeRegionCode } from './regionCode'

export type RegionSelectionLevel = 'PROVINCE' | 'GROUP' | 'LOCALITY'

export interface RegionItem {
  regionCode: string
  regionName: string
  selectionLevel: RegionSelectionLevel
  parentCode: string | null
  autoSelect: boolean
}

export interface RegionSelectionList {
  items: RegionItem[]
  requestId: string
  regionVersion: string
  codeSystem: 'MOIS_H10'
  sourceReferenceOn: string | null
  sourceFileVersion: string
}

type RegionEnvelope = {
  data: { items: RegionItem[] }
  meta: Omit<RegionSelectionList, 'items'>
}

const regionVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isRegionVersion(value: unknown): value is string {
  return typeof value === 'string' && regionVersionPattern.test(value)
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isRegionEnvelope(
  value: unknown,
  level: RegionSelectionLevel,
  parent: string | null,
  version?: string,
): value is RegionEnvelope {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    !Array.isArray(value.data.items) ||
    !isRecord(value.meta) ||
    !isNonEmptyString(value.meta.requestId) ||
    !isRegionVersion(value.meta.regionVersion) ||
    (version !== undefined && value.meta.regionVersion !== version) ||
    value.meta.codeSystem !== 'MOIS_H10' ||
    (value.meta.sourceReferenceOn !== null && !isDate(value.meta.sourceReferenceOn)) ||
    !isNonEmptyString(value.meta.sourceFileVersion)
  ) {
    return false
  }

  const seen = new Set<string>()
  for (const item of value.data.items) {
    if (
      !isRecord(item) ||
      !isAdministrativeRegionCode(item.regionCode) ||
      !isNonEmptyString(item.regionName) ||
      item.selectionLevel !== level ||
      item.parentCode !== parent ||
      typeof item.autoSelect !== 'boolean' ||
      (level !== 'GROUP' && item.autoSelect) ||
      seen.has(item.regionCode)
    ) {
      return false
    }

    seen.add(item.regionCode)
  }

  return true
}

async function getRegionList(
  path: string,
  level: RegionSelectionLevel,
  parent: string | null,
  version?: string,
  signal?: AbortSignal,
): Promise<RegionSelectionList> {
  const body = await requestFullEnvelopeJson(
    path,
    (value): value is RegionEnvelope => isRegionEnvelope(value, level, parent, version),
    { signal },
  )

  return {
    items: body.data.items,
    requestId: body.meta.requestId,
    regionVersion: body.meta.regionVersion,
    codeSystem: body.meta.codeSystem,
    sourceReferenceOn: body.meta.sourceReferenceOn,
    sourceFileVersion: body.meta.sourceFileVersion,
  }
}

export function getProvinces(signal?: AbortSignal): Promise<RegionSelectionList> {
  return getRegionList('/regions/provinces', 'PROVINCE', null, undefined, signal)
}

function childQuery(
  parentField: 'provinceCode' | 'groupCode',
  code: string,
  version: string,
): string {
  if (!isAdministrativeRegionCode(code)) {
    throw new ApiError('지역 코드 형식을 확인해 주세요.', 400, 'INVALID_REGION_CODE')
  }
  if (!isRegionVersion(version)) {
    throw new ApiError('지역 기준정보 버전을 확인해 주세요.', 400, 'INVALID_REQUEST')
  }

  return new URLSearchParams({ [parentField]: code, regionVersion: version }).toString()
}

export async function getGroups(
  provinceCode: string,
  version: string,
  signal?: AbortSignal,
): Promise<RegionSelectionList> {
  const query = childQuery('provinceCode', provinceCode, version)
  return getRegionList(`/regions/groups?${query}`, 'GROUP', provinceCode, version, signal)
}

export async function getLocalities(
  groupCode: string,
  version: string,
  signal?: AbortSignal,
): Promise<RegionSelectionList> {
  const query = childQuery('groupCode', groupCode, version)
  return getRegionList(`/regions/localities?${query}`, 'LOCALITY', groupCode, version, signal)
}
