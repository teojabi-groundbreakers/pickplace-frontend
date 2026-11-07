// The current reference API provides only Seoul districts and has no province endpoint.
export type ReferenceProvince = { code: string; name: string }

export const referenceProvinces: ReferenceProvince[] = [{ code: '11', name: '서울특별시' }]
export const seoulProvinceCode = '11'
