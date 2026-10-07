import type { AnalysisRequest, Catalog } from '../types/analysis'

export interface SearchSelection {
  cityCode: string
  districtCode: string
  regionCode: string
  categoryCode: string
  industryCode: string
}

export function selectionFromRequest(catalog: Catalog, request: AnalysisRequest): SearchSelection {
  const city = catalog.cities.find((item) =>
    item.districts.some((district) =>
      district.neighborhoods.some((region) => region.code === request.regionCode),
    ),
  )
  const district = city?.districts.find((item) =>
    item.neighborhoods.some((region) => region.code === request.regionCode),
  )
  const category = catalog.categories.find((item) =>
    item.industries.some((industry) => industry.code === request.industryCode),
  )
  return {
    cityCode: city?.code || '',
    districtCode: district?.code || '',
    regionCode: district ? request.regionCode : '',
    categoryCode: category?.code || '',
    industryCode: category ? request.industryCode : '',
  }
}
