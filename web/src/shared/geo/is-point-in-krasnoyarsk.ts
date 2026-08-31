import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { krasnoyarskBoundary } from './krasnoyarsk-boundary.data';

/** WGS84 latitude / longitude. Points on the boundary are allowed. */
export function isPointInKrasnoyarsk(lat: number, lng: number): boolean {
  return booleanPointInPolygon(point([lng, lat]), krasnoyarskBoundary);
}
