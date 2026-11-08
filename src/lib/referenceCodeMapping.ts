import referenceSnapshot from '../data/seoulReferenceCodes.json'
import { isAdministrativeRegionCode } from './regionCode'

type District = { districtCode: string; districtName: string }
type AdministrativeDong = {
  dongCode: string
  dongName: string
  districtCode: string
  officialCodeStatus: string
  regionVersion: string
}

type SnapshotDistrict = { code: string; name: string }
type SnapshotDong = {
  code: string
  name: string
  districtCode: string
  officialCode: string
  officialName: string
  status: 'CURRENT' | 'LEGACY'
}
type ReferenceSnapshot = {
  sourceProject: string
  sourcePath: string
  sourceSha256: string
  version: string
  officialSnapshotOn: string
  districts: SnapshotDistrict[]
  dongs: SnapshotDong[]
}

type UnavailableReason =
  | 'MISSING_INPUT'
  | 'SNAPSHOT_INVALID'
  | 'DISTRICT_MISMATCH'
  | 'DONG_MISMATCH'
  | 'VERSION_MISMATCH'
  | 'LEGACY'

export type ReferenceCodeResult =
  | { status: 'available'; officialCode: string; officialName: string }
  | { status: 'unavailable'; reason: UnavailableReason }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Fixed snapshot derived from the BE reference import verified against MOIS on
 * 2026-10-12. It is not a live H-code mapping or an administrative boundary.
 */
export function isReferenceSnapshot(value: unknown): value is ReferenceSnapshot {
  if (
    !isRecord(value) ||
    !isText(value.sourceProject) ||
    !isText(value.sourcePath) ||
    typeof value.sourceSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sourceSha256) ||
    !isText(value.version) ||
    typeof value.officialSnapshotOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.officialSnapshotOn) ||
    !Array.isArray(value.districts) ||
    !Array.isArray(value.dongs)
  ) {
    return false
  }

  const districtCodes = new Set<string>()
  for (const district of value.districts) {
    if (
      !isRecord(district) ||
      typeof district.code !== 'string' ||
      !/^\d{5}$/.test(district.code) ||
      !isText(district.name) ||
      districtCodes.has(district.code)
    ) {
      return false
    }
    districtCodes.add(district.code)
  }

  const dongCodes = new Set<string>()
  const officialCodes = new Set<string>()
  for (const dong of value.dongs) {
    if (
      !isRecord(dong) ||
      typeof dong.code !== 'string' ||
      !/^\d{8}$/.test(dong.code) ||
      !isText(dong.name) ||
      typeof dong.districtCode !== 'string' ||
      !districtCodes.has(dong.districtCode) ||
      !isAdministrativeRegionCode(dong.officialCode) ||
      !isText(dong.officialName) ||
      (dong.status !== 'CURRENT' && dong.status !== 'LEGACY') ||
      dongCodes.has(dong.code) ||
      officialCodes.has(dong.officialCode)
    ) {
      return false
    }
    dongCodes.add(dong.code)
    officialCodes.add(dong.officialCode)
  }

  return districtCodes.size > 0 && dongCodes.size > 0
}

const snapshot: ReferenceSnapshot | null = isReferenceSnapshot(referenceSnapshot)
  ? referenceSnapshot
  : null

export const referenceCodeSnapshotMetadata = snapshot
  ? {
      sourceProject: snapshot.sourceProject,
      sourcePath: snapshot.sourcePath,
      sourceSha256: snapshot.sourceSha256,
      version: snapshot.version,
      officialSnapshotOn: snapshot.officialSnapshotOn,
    }
  : null

/**
 * Matches the unmodified BE list response against the complete, versioned
 * reference snapshot. Never derives an H10 code from an eight-digit code.
 */
export function mapReferenceCode(
  district: District | null | undefined,
  dong: AdministrativeDong | null | undefined,
): ReferenceCodeResult {
  if (
    !district ||
    !dong ||
    !isText(district.districtCode) ||
    !isText(district.districtName) ||
    !isText(dong.dongCode) ||
    !isText(dong.dongName) ||
    !isText(dong.districtCode) ||
    !isText(dong.officialCodeStatus) ||
    !isText(dong.regionVersion)
  ) {
    return { status: 'unavailable', reason: 'MISSING_INPUT' }
  }
  if (!snapshot) return { status: 'unavailable', reason: 'SNAPSHOT_INVALID' }
  if (dong.regionVersion !== snapshot.version) {
    return { status: 'unavailable', reason: 'VERSION_MISMATCH' }
  }

  const sourceDistrict = snapshot.districts.find((item) => item.code === district.districtCode)
  if (
    !sourceDistrict ||
    sourceDistrict.name !== district.districtName ||
    dong.districtCode !== district.districtCode
  ) {
    return { status: 'unavailable', reason: 'DISTRICT_MISMATCH' }
  }

  const sourceDong = snapshot.dongs.find((item) => item.code === dong.dongCode)
  if (
    !sourceDong ||
    sourceDong.name !== dong.dongName ||
    sourceDong.districtCode !== dong.districtCode ||
    sourceDong.status !== dong.officialCodeStatus
  ) {
    return { status: 'unavailable', reason: 'DONG_MISMATCH' }
  }
  if (sourceDong.status !== 'CURRENT') return { status: 'unavailable', reason: 'LEGACY' }

  return {
    status: 'available',
    officialCode: sourceDong.officialCode,
    officialName: sourceDong.officialName,
  }
}
