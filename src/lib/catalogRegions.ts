import type { Catalog } from '../types/analysis'
import type { MapRegion } from '../types/map'

export function catalogRegions(catalog: Catalog | null): MapRegion[] {
  return (
    catalog?.cities.flatMap((city) =>
      city.districts.flatMap((district) =>
        district.neighborhoods.map((region) => ({
          ...region,
          fullName: `${city.name} ${district.name} ${region.name}`,
        })),
      ),
    ) || []
  )
}
