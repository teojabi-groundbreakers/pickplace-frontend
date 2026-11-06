import type {
  BoundaryGeometry,
  BoundaryLinearRing,
  BoundaryPolygonCoordinates,
  BoundaryPosition,
  MapBoundaryPolygons,
  RegionBoundary,
} from '../types/boundary'
import { ApiError, requestJson } from './api'
import { config } from './config'

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const string = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const isAdministrativeRegionCode = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{10}$/.test(value)

function isPosition(value: unknown): value is BoundaryPosition {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    Math.abs(value[0]) <= 180 &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1]) &&
    Math.abs(value[1]) <= 90
  )
}

function isLinearRing(value: unknown): value is BoundaryLinearRing {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) return false

  const first = value[0]
  const last = value[value.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) return false

  return (
    new Set(value.slice(0, -1).map(([longitude, latitude]) => `${longitude},${latitude}`)).size >= 3
  )
}

function isPolygon(value: unknown): value is BoundaryPolygonCoordinates {
  return Array.isArray(value) && value.length > 0 && value.every(isLinearRing)
}

export function isBoundaryGeometry(value: unknown): value is BoundaryGeometry {
  if (!object(value)) return false

  if (value.type === 'Polygon') return isPolygon(value.coordinates)

  return (
    value.type === 'MultiPolygon' &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length > 0 &&
    value.coordinates.every(isPolygon)
  )
}

function isBoundaryDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isSourceUrl(value: unknown): value is string {
  if (!string(value)) return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function isRegionBoundary(value: unknown): value is RegionBoundary {
  return (
    object(value) &&
    isAdministrativeRegionCode(value.regionCode) &&
    value.regionType === 'H' &&
    string(value.regionName) &&
    value.coordinateSystem === 'EPSG:4326' &&
    isBoundaryGeometry(value.geometry) &&
    isPosition(value.labelPosition) &&
    isBoundaryDate(value.boundaryDate) &&
    object(value.source) &&
    string(value.source.name) &&
    isSourceUrl(value.source.url)
  )
}

export async function getRegionBoundary(
  regionCode: string,
  signal?: AbortSignal,
): Promise<RegionBoundary | null> {
  if (!isAdministrativeRegionCode(regionCode)) {
    throw new ApiError('조회할 행정동 코드가 올바르지 않습니다.', 400, 'INVALID_REGION_CODE')
  }

  if (config.demoMode) return null

  try {
    const boundary = await requestJson(`/regions/${regionCode}/boundary`, isRegionBoundary, {
      signal,
    })

    if (boundary.regionCode !== regionCode) {
      throw new ApiError('요청 지역과 경계 응답이 일치하지 않습니다.', 200, 'INVALID_RESPONSE')
    }

    return boundary
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === 'BOUNDARY_NOT_AVAILABLE'
    ) {
      return null
    }

    throw error
  }
}

export function geometryToMapPolygons(geometry: BoundaryGeometry): MapBoundaryPolygons {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

  return polygons.map((polygon) =>
    polygon.map((ring) => ring.map(([longitude, latitude]) => [latitude, longitude])),
  )
}
