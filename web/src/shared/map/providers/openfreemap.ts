import type { MapStyleProvider } from './types';

/** OpenFreeMap public vector styles — no API key required. */
export const openFreeMapBrightProvider: MapStyleProvider = {
  id: 'openfreemap-bright',
  styleUrl: 'https://tiles.openfreemap.org/styles/bright',
  attribution: '© OpenFreeMap © OpenStreetMap contributors',
};

export const openFreeMapLibertyProvider: MapStyleProvider = {
  id: 'openfreemap-liberty',
  styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  attribution: '© OpenFreeMap © OpenStreetMap contributors',
};
