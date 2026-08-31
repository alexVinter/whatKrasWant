import { useEffect, useRef, useState } from 'react';
import { Map, Marker } from 'maplibre-gl';
import '../../../shared/map/maplibreSetup';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  ensureCompactAttributionCollapsed,
  toMapLibreCenter,
} from '../../../shared/map/config';
import { createIdeaMarkerElement } from '../../../shared/map/createIdeaMarkerElement';
import { getActiveMapStyleProvider } from '../../../shared/map/providers';
import { isPointInKrasnoyarsk } from '../../../shared/geo/is-point-in-krasnoyarsk';
import { KRASNOYARSK_GEO_ERROR } from '../../../shared/geo/krasnoyarsk.constants';
import '../../../shared/map/maplibreMap.css';
import styles from './form.module.css';

interface IdeaGeoMapPickerProps {
  latitude: string;
  longitude: string;
  onChange: (patch: { latitude: string; longitude: string }) => void;
}

function parseCoord(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatCoord(value: number): string {
  return value.toFixed(6);
}

export function IdeaGeoMapPicker({
  latitude,
  longitude,
  onChange,
}: IdeaGeoMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [mapReadyVersion, setMapReadyVersion] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) {
      return;
    }

    let map: Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const initMap = () => {
      if (mapRef.current || !containerRef.current) {
        return;
      }

      const provider = getActiveMapStyleProvider();
      map = new Map({
        container: containerRef.current,
        style: provider.styleUrl,
        center: toMapLibreCenter(DEFAULT_MAP_CENTER),
        zoom: DEFAULT_MAP_ZOOM,
        interactive: true,
        attributionControl: { compact: true },
      });
      ensureCompactAttributionCollapsed(map);

      map.on('error', (event) => {
        console.error('MAPLIBRE ERROR:', event.error ?? event);
      });

      map.on('click', (event) => {
        const lat = event.lngLat.lat;
        const lng = event.lngLat.lng;
        if (!isPointInKrasnoyarsk(lat, lng)) {
          setGeoError(KRASNOYARSK_GEO_ERROR);
          return;
        }

        setGeoError(null);
        onChangeRef.current({
          latitude: formatCoord(lat),
          longitude: formatCoord(lng),
        });
      });

      mapRef.current = map;

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          map?.resize();
        });
        resizeObserver.observe(containerRef.current);
      }

      map.once('load', () => {
        map?.resize();
        setMapReadyVersion((version) => version + 1);
      });
    };

    if (container.getBoundingClientRect().width > 0) {
      initMap();
    } else {
      queueMicrotask(initMap);
    }

    return () => {
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const syncMarker = () => {
      const lat = parseCoord(latitude);
      const lng = parseCoord(longitude);

      if (lat === null || lng === null) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }

      if (isPointInKrasnoyarsk(lat, lng)) {
        setGeoError(null);
      }

      const lngLat: [number, number] = [lng, lat];
      if (!markerRef.current) {
        markerRef.current = new Marker({ element: createIdeaMarkerElement() })
          .setLngLat(lngLat)
          .addTo(map);
      } else {
        markerRef.current.setLngLat(lngLat);
      }

      map.setCenter(lngLat);
      if (map.getZoom() < 13) {
        map.setZoom(14);
      }
    };

    if (map.isStyleLoaded()) {
      syncMarker();
      return;
    }

    map.once('load', syncMarker);
  }, [latitude, longitude, mapReadyVersion]);

  return (
    <div className={styles.geoMapField}>
      <div
        ref={containerRef}
        className={styles.geoMap}
        aria-label="Геометка на карте"
        role="application"
      />
      {geoError && (
        <p className={styles.geoError} role="alert">
          {geoError}
        </p>
      )}
    </div>
  );
}
