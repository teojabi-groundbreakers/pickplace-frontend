export type BoundaryPosition = [longitude: number, latitude: number]

export type BoundaryLinearRing = BoundaryPosition[]

export type BoundaryPolygonCoordinates = BoundaryLinearRing[]

export type BoundaryGeometry =
  | { type: 'Polygon'; coordinates: BoundaryPolygonCoordinates }
  | { type: 'MultiPolygon'; coordinates: BoundaryPolygonCoordinates[] }

export interface RegionBoundary {
  regionCode: string
  regionType: 'H'
  regionName: string
  coordinateSystem: 'EPSG:4326'
  geometry: BoundaryGeometry
  labelPosition: BoundaryPosition
  boundaryDate: string
  source: {
    name: string
    url: string
  }
}

export type MapBoundaryPolygons = [latitude: number, longitude: number][][][]
