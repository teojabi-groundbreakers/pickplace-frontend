import { describe, expect, it } from 'vitest'
import snapshot from '../data/seoulReferenceCodes.json'
import {
  isReferenceSnapshot,
  mapReferenceCode,
  referenceCodeSnapshotMetadata,
} from '../lib/referenceCodeMapping'
type District = { districtCode: string; districtName: string }
type AdministrativeDong = {
  dongCode: string
  dongName: string
  districtCode: string
  officialCodeStatus: string
  regionVersion: string
}

const district: District = { districtCode: '11560', districtName: '영등포구' }
const dong: AdministrativeDong = {
  dongCode: '11560700',
  dongName: '대림1동',
  districtCode: '11560',
  officialCodeStatus: 'CURRENT',
  regionVersion: 'seoul-reference-20262-mois-20261012-v1',
}

describe('검증된 BE 기준정보 스냅샷 대응', () => {
  it('스냅샷의 출처, 기준일, 원본 해시 및 전체 레코드가 보존된다', () => {
    expect(referenceCodeSnapshotMetadata).toMatchObject({
      sourceProject: 'pickplace-backend-develop',
      sourcePath: 'src/main/resources/reference-data/seoul-reference.json',
      sourceSha256: 'da5e5e5aaccc7f6ca0e2706dc925a6076274491211060bd386388759e35ec796',
      version: 'seoul-reference-20262-mois-20261012-v1',
      officialSnapshotOn: '2026-10-12',
    })
    expect(snapshot.districts).toHaveLength(25)
    expect(snapshot.dongs).toHaveLength(425)
    expect(isReferenceSnapshot(snapshot)).toBe(true)
  })

  it('BE 구·동의 모든 식별 정보와 버전이 일치할 때 원본 공식 코드를 반환한다', () => {
    expect(mapReferenceCode(district, dong)).toEqual({
      status: 'available',
      officialCode: '1156070000',
      officialName: '대림제1동',
    })
  })

  it('기준 버전이나 부모 지역·이름·상태가 다르면 대응하지 않는다', () => {
    expect(mapReferenceCode(district, { ...dong, regionVersion: 'new-version' })).toMatchObject({
      reason: 'VERSION_MISMATCH',
    })
    expect(mapReferenceCode({ ...district, districtName: '다른 구' }, dong)).toMatchObject({
      reason: 'DISTRICT_MISMATCH',
    })
    expect(mapReferenceCode(district, { ...dong, districtCode: '11110' })).toMatchObject({
      reason: 'DISTRICT_MISMATCH',
    })
    expect(mapReferenceCode(district, { ...dong, dongName: '대림2동' })).toMatchObject({
      reason: 'DONG_MISMATCH',
    })
    expect(mapReferenceCode(district, { ...dong, officialCodeStatus: 'LEGACY' })).toMatchObject({
      reason: 'DONG_MISMATCH',
    })
  })

  it('누락·미등록·과거 지역은 8자리 코드를 변환해 반환하지 않는다', () => {
    expect(mapReferenceCode(null, dong)).toMatchObject({ reason: 'MISSING_INPUT' })
    expect(mapReferenceCode(district, { ...dong, dongName: '' })).toMatchObject({
      reason: 'MISSING_INPUT',
    })
    expect(mapReferenceCode(district, { ...dong, dongCode: '11560999' })).toMatchObject({
      reason: 'DONG_MISMATCH',
    })
    expect(
      mapReferenceCode(
        { districtCode: '11230', districtName: '동대문구' },
        {
          ...dong,
          dongCode: '11230536',
          dongName: '용신동',
          districtCode: '11230',
          officialCodeStatus: 'LEGACY',
        },
      ),
    ).toEqual({ status: 'unavailable', reason: 'LEGACY' })
  })

  it('중복 코드, 잘못된 형식과 존재하지 않는 부모를 가진 스냅샷을 거부한다', () => {
    expect(
      isReferenceSnapshot({
        ...snapshot,
        districts: [...snapshot.districts, snapshot.districts[0]],
      }),
    ).toBe(false)
    expect(
      isReferenceSnapshot({ ...snapshot, dongs: [...snapshot.dongs, snapshot.dongs[0]] }),
    ).toBe(false)
    expect(
      isReferenceSnapshot({ ...snapshot, dongs: [{ ...snapshot.dongs[0], officialCode: '000' }] }),
    ).toBe(false)
    expect(
      isReferenceSnapshot({
        ...snapshot,
        dongs: [{ ...snapshot.dongs[0], districtCode: '99999' }],
      }),
    ).toBe(false)
    expect(isReferenceSnapshot({ ...snapshot, sourceSha256: 'invalid' })).toBe(false)
  })
})
