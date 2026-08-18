import { openFreeMapBrightProvider } from './openfreemap';
import type { MapStyleProvider } from './types';

export type { MapStyleProvider } from './types';
export { openFreeMapBrightProvider, openFreeMapLibertyProvider } from './openfreemap';

/**
 * Active basemap provider. Swap this export to change the map source
 * without touching marker/popup business logic.
 */
export function getActiveMapStyleProvider(): MapStyleProvider {
  return openFreeMapBrightProvider;
}
