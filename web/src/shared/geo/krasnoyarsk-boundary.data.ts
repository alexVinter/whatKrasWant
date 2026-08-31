import type { Feature, MultiPolygon, Polygon } from 'geojson';
import boundaryRaw from './krasnoyarsk-boundary.geojson?raw';

export const krasnoyarskBoundary = JSON.parse(boundaryRaw) as Feature<
  Polygon | MultiPolygon
>;
