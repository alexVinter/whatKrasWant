import type { Map } from 'maplibre-gl';

/** Krasnoyarsk center — WGS84 [latitude, longitude]. */
export const DEFAULT_MAP_CENTER: [number, number] = [56.0153, 92.8932];
export const DEFAULT_MAP_ZOOM = 12;

/** MapLibre expects [longitude, latitude]. */
export function toMapLibreCenter(center: [number, number]): [number, number] {
  return [center[1], center[0]];
}

/** Collapse compact attribution to the info (ⓘ) button until the user toggles it. */
export function ensureCompactAttributionCollapsed(map: Map): void {
  let userToggled = false;

  const collapse = () => {
    if (userToggled) {
      return;
    }

    const details = map.getContainer().querySelector<HTMLDetailsElement>(
      'details.maplibregl-ctrl-attrib.maplibregl-compact',
    );
    if (!details?.classList.contains('maplibregl-compact-show')) {
      return;
    }

    details.classList.remove('maplibregl-compact-show');
    details.open = true;
  };

  map.getContainer().addEventListener(
    'click',
    (event) => {
      if ((event.target as HTMLElement).closest('.maplibregl-ctrl-attrib-button')) {
        userToggled = true;
      }
    },
    true,
  );

  map.once('idle', collapse);
  map.on('styledata', collapse);
}
