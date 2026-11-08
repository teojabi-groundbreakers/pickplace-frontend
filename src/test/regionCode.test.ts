import { describe, expect, it } from 'vitest'
import { isAdministrativeRegionCode } from '../lib/regionCode'
import { isAdministrativeRegionCode as isBoundaryRegionCode } from '../lib/regionBoundary'

describe('행정동 코드 형식', () => {
  it('숫자 10자리 문자열을 원형 그대로 확인하며 앞의 0을 보존한다', () => {
    expect(isAdministrativeRegionCode('0123456789')).toBe(true)
    expect(isBoundaryRegionCode('0123456789')).toBe(true)
  })

  it.each([1156070000, '11560700', '11560700000', '115607000a', ' 1156070000', null])(
    '숫자형 또는 잘못된 형식 %s를 거부한다',
    (value) => {
      expect(isAdministrativeRegionCode(value)).toBe(false)
      expect(isBoundaryRegionCode(value)).toBe(false)
    },
  )
})
