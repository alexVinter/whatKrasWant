import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

type KrasnoyarskBoundary = Feature<Polygon | MultiPolygon>;

let cachedBoundary: KrasnoyarskBoundary | null = null;

function loadBoundary(): KrasnoyarskBoundary {
  if (cachedBoundary) {
    return cachedBoundary;
  }

  const filePath = join(__dirname, 'krasnoyarsk-boundary.geojson');
  const raw = readFileSync(filePath, 'utf8');
  cachedBoundary = JSON.parse(raw) as KrasnoyarskBoundary;
  return cachedBoundary;
}

/** WGS84 latitude / longitude. Points on the boundary are allowed. */
export function isPointInKrasnoyarsk(lat: number, lng: number): boolean {
  return booleanPointInPolygon(point([lng, lat]), loadBoundary());
}

/** Test helper: reset cached boundary between cases. */
export function resetKrasnoyarskBoundaryCache(): void {
  cachedBoundary = null;
}
