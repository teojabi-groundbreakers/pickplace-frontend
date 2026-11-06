import { ApiError, requestEnvelopeJson } from './api'
import { getDistricts as getServiceDistricts } from './serviceApi'

export type District = {
  districtCode: string
  districtName: string
}

export type AdministrativeDong = {
  dongCode: string
  dongName: string
  districtCode: string
  officialCodeStatus: string
  regionVersion: string
}

export type BusinessType = {
  businessTypeCode: string
  businessTypeName: string
  supported: boolean
}

export type ReferenceList<T> = {
  items: T[]
  requestId: string
}

type ObjectValue = Record<string, unknown>

function isObject(value: unknown): value is ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isDong(value: unknown): value is AdministrativeDong {
  return (
    isObject(value) &&
    typeof value.dongCode === 'string' &&
    /^\d{8}$/.test(value.dongCode) &&
    isNonEmptyString(value.dongName) &&
    typeof value.districtCode === 'string' &&
    /^\d{5}$/.test(value.districtCode) &&
    isNonEmptyString(value.officialCodeStatus) &&
    isNonEmptyString(value.regionVersion)
  )
}

function isBusinessType(value: unknown): value is BusinessType {
  return (
    isObject(value) &&
    isNonEmptyString(value.businessTypeCode) &&
    isNonEmptyString(value.businessTypeName) &&
    typeof value.supported === 'boolean'
  )
}

function isList<T>(value: unknown, isItem: (item: unknown) => item is T): value is { items: T[] } {
  return isObject(value) && Array.isArray(value.items) && value.items.every(isItem)
}

export async function getDistricts(signal?: AbortSignal): Promise<ReferenceList<District>> {
  const result = await getServiceDistricts(signal)
  return {
    items: result.data.items.map(({ code, name }) => ({
      districtCode: code,
      districtName: name,
    })),
    requestId: result.requestId,
  }
}

export async function getAdministrativeDongs(
  districtCode: string,
  signal?: AbortSignal,
): Promise<ReferenceList<AdministrativeDong>> {
  const result = await requestEnvelopeJson(
    `/districts/${encodeURIComponent(districtCode)}/administrative-dongs`,
    (value): value is { items: AdministrativeDong[] } => isList(value, isDong),
    { signal },
  )

  if (result.data.items.some((item) => item.districtCode !== districtCode)) {
    throw new ApiError(
      '요청한 자치구와 행정동 목록이 일치하지 않습니다.',
      200,
      'INVALID_RESPONSE',
      result.requestId,
    )
  }

  return { items: result.data.items, requestId: result.requestId }
}

export async function getBusinessTypes(signal?: AbortSignal): Promise<ReferenceList<BusinessType>> {
  const result = await requestEnvelopeJson(
    '/business-types',
    (value): value is { items: BusinessType[] } => isList(value, isBusinessType),
    { signal },
  )
  return { items: result.data.items, requestId: result.requestId }
}
