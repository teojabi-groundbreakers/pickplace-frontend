import type { Option } from '../types/analysis'
import { requestEnvelopeJson, type ApiResult } from './api'

interface HealthData {
  status: 'UP'
}

interface DistrictItem {
  districtCode: string
  districtName: string
}

interface DistrictListResponse {
  items: DistrictItem[]
}

interface DistrictListData {
  items: Option[]
}

function isHealthData(value: unknown): value is HealthData {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'UP'
}

function isDistrictItem(value: unknown): value is DistrictItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'districtCode' in value &&
    typeof value.districtCode === 'string' &&
    /^\d{5}$/.test(value.districtCode) &&
    'districtName' in value &&
    typeof value.districtName === 'string' &&
    value.districtName.trim().length > 0
  )
}

function isDistrictList(value: unknown): value is DistrictListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.every(isDistrictItem)
  )
}

export function getServiceHealth(signal?: AbortSignal): Promise<ApiResult<HealthData>> {
  return requestEnvelopeJson('/health', isHealthData, { signal })
}

export function getDatabaseReadiness(signal?: AbortSignal): Promise<ApiResult<HealthData>> {
  return requestEnvelopeJson('/health/ready', isHealthData, { signal })
}

export async function getDistricts(signal?: AbortSignal): Promise<ApiResult<DistrictListData>> {
  const { data, requestId } = await requestEnvelopeJson('/districts', isDistrictList, { signal })

  return {
    data: {
      items: data.items.map(({ districtCode, districtName }) => ({
        code: districtCode,
        name: districtName,
      })),
    },
    requestId,
  }
}
