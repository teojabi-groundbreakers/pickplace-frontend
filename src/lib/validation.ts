import type { Analysis, AnalysisRequest, Catalog } from '../types/analysis'

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const str = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const num = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const positive = (value: unknown) => num(value) && value >= 0

const list = (value: unknown, check: (item: unknown) => boolean, minimum = 0) =>
  Array.isArray(value) && value.length >= minimum && value.every(check)

const option = (value: unknown) => object(value) && str(value.code) && str(value.name)

const coordinate = (value: unknown) =>
  Array.isArray(value) &&
  value.length === 2 &&
  num(value[0]) &&
  num(value[1]) &&
  Math.abs(value[0]) <= 90 &&
  Math.abs(value[1]) <= 180

const score = (value: unknown) =>
  object(value) &&
  num(value.value) &&
  value.value >= 0 &&
  value.value <= 100 &&
  str(value.grade) &&
  str(value.description)

export function isCatalog(value: unknown): value is Catalog {
  return (
    object(value) &&
    list(
      value.cities,
      (city) =>
        object(city) &&
        option(city) &&
        list(
          city.districts,
          (district) =>
            object(district) &&
            option(district) &&
            list(
              district.neighborhoods,
              (region) => object(region) && option(region) && coordinate(region.center),
              1,
            ),
          1,
        ),
      1,
    ) &&
    list(
      value.categories,
      (category) => object(category) && option(category) && list(category.industries, option, 1),
      1,
    )
  )
}

export function isAnalysis(value: unknown): value is Analysis {
  if (
    !object(value) ||
    !str(value.id) ||
    !object(value.request) ||
    !str(value.request.regionCode) ||
    !str(value.request.industryCode)
  ) {
    return false
  }

  return (
    str(value.regionName) &&
    str(value.industryName) &&
    /^\d{4}\.(0[1-9]|1[0-2])$/.test(String(value.period)) &&
    str(value.analyzedAt) &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value.analyzedAt) &&
    Number.isFinite(Date.parse(value.analyzedAt)) &&
    ['demo', 'api'].includes(String(value.source)) &&
    object(value.scores) &&
    ['overall', 'growth', 'risk', 'fit'].every((key) =>
      score((value.scores as Record<string, unknown>)[key]),
    ) &&
    list(
      value.factors,
      (item) => object(item) && str(item.name) && str(item.description) && num(item.contribution),
    ) &&
    list(
      value.trends,
      (item) =>
        object(item) &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(String(item.month)) &&
        ['sales', 'population', 'stores', 'openings', 'closures', 'averageSales'].every((key) =>
          positive(item[key]),
        ),
      1,
    ) &&
    (value.trends as Record<string, unknown>[]).every(
      (item, index, trends) => index === 0 || String(item.month) > String(trends[index - 1].month),
    ) &&
    list(
      value.competition,
      (item) =>
        object(item) &&
        str(item.name) &&
        positive(item.local) &&
        positive(item.average) &&
        str(item.unit),
    ) &&
    object(value.map) &&
    coordinate(value.map.center) &&
    list(value.map.boundary, coordinate) &&
    list(
      value.map.places,
      (item) =>
        object(item) &&
        str(item.id) &&
        str(item.name) &&
        ['competitor', 'transport', 'facility'].includes(String(item.type)) &&
        coordinate(item.position),
    ) &&
    str(value.summary) &&
    list(value.recommendations, str)
  )
}

export function validateSelection(request: AnalysisRequest, catalog: Catalog): string | null {
  if (
    !catalog.cities.some((city) =>
      city.districts.some((district) =>
        district.neighborhoods.some((region) => region.code === request.regionCode),
      ),
    )
  ) {
    return '분석할 행정동을 선택해 주세요.'
  }

  if (
    !catalog.categories.some((category) =>
      category.industries.some((industry) => industry.code === request.industryCode),
    )
  ) {
    return '세부 업종을 선택해 주세요.'
  }

  return null
}
