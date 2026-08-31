import { isPointInKrasnoyarsk } from './is-point-in-krasnoyarsk';

/** Krasnoyarsk center — inside the city administrative boundary. */
const KRASNOYARSK_CENTER = { lat: 56.0153, lng: 92.8932 };

/** Moscow — clearly outside Krasnoyarsk. */
const MOSCOW = { lat: 55.7558, lng: 37.6173 };

/**
 * South of the boundary bbox min latitude (55.9118405), near the city but outside
 * the administrative polygon.
 */
const SOUTH_OF_CITY = { lat: 55.905, lng: 92.8932 };

describe('isPointInKrasnoyarsk', () => {
  it('accepts the Krasnoyarsk center', () => {
    expect(isPointInKrasnoyarsk(KRASNOYARSK_CENTER.lat, KRASNOYARSK_CENTER.lng)).toBe(
      true,
    );
  });

  it('rejects Moscow', () => {
    expect(isPointInKrasnoyarsk(MOSCOW.lat, MOSCOW.lng)).toBe(false);
  });

  it('rejects a point south of the city boundary', () => {
    expect(isPointInKrasnoyarsk(SOUTH_OF_CITY.lat, SOUTH_OF_CITY.lng)).toBe(false);
  });
});
