/** Krasnoyarsk center — WGS84 [latitude, longitude]. */
export const DEFAULT_MAP_CENTER: [number, number] = [56.0153, 92.8932];
export const DEFAULT_MAP_ZOOM = 12;

/** MapLibre expects [longitude, latitude]. */
export function toMapLibreCenter(center: [number, number]): [number, number] {
  return [center[1], center[0]];
}
