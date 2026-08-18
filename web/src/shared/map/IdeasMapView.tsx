import { useEffect, useRef, useState } from 'react';
import { Map, Marker, NavigationControl, Popup, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './maplibreSetup';
import type { PublicMapIdea } from '../../features/public-ideas/types';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  toMapLibreCenter,
} from './config';
import { createIdeaMarkerElement } from './createIdeaMarkerElement';
import { createIdeaPopupElement } from './createIdeaPopupElement';
import { getActiveMapStyleProvider } from './providers';
import './maplibreMap.css';

interface IdeasMapViewProps {
  markers: PublicMapIdea[];
  className?: string;
  interactive?: boolean;
  showPopups?: boolean;
  height?: number | string;
}

function fitMapToMarkers(map: Map, markers: PublicMapIdea[]): void {
  if (markers.length === 0) {
    map.setCenter(toMapLibreCenter(DEFAULT_MAP_CENTER));
    map.setZoom(DEFAULT_MAP_ZOOM);
    return;
  }

  if (markers.length === 1) {
    map.setCenter([markers[0].longitude, markers[0].latitude]);
    map.setZoom(14);
    return;
  }

  const bounds = new LngLatBounds();
  for (const marker of markers) {
    bounds.extend([marker.longitude, marker.latitude]);
  }
  map.fitBounds(bounds, { padding: 32, maxZoom: 14 });
}

export function IdeasMapView({
  markers,
  className,
  interactive = true,
  showPopups = true,
  height = '100%',
}: IdeasMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerHandlesRef = useRef<Marker[]>([]);
  const [mapReadyVersion, setMapReadyVersion] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) {
      return;
    }

    let map: Map | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;

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
        interactive,
      });

      map.on('error', (event) => {
        console.error('MAPLIBRE ERROR:', event.error ?? event);
      });

      map.addControl(new NavigationControl({ showCompass: false }), 'top-left');
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
    } else if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            initMap();
            intersectionObserver?.disconnect();
          }
        },
        { rootMargin: '240px' },
      );
      intersectionObserver.observe(container);
    } else {
      initMap();
    }

    return () => {
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
      for (const handle of markerHandlesRef.current) {
        handle.remove();
      }
      markerHandlesRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const syncMarkers = () => {
      for (const handle of markerHandlesRef.current) {
        handle.remove();
      }
      markerHandlesRef.current = [];

      for (const marker of markers) {
        const element = createIdeaMarkerElement();
        const mapMarker = new Marker({ element })
          .setLngLat([marker.longitude, marker.latitude])
          .addTo(map);

        if (showPopups) {
          const popup = new Popup({
            offset: 24,
            closeButton: false,
            maxWidth: '505px',
            className: 'idea-map-popup-shell',
          }).setDOMContent(createIdeaPopupElement(marker));
          mapMarker.setPopup(popup);
        }

        markerHandlesRef.current.push(mapMarker);
      }

      fitMapToMarkers(map, markers);
    };

    if (map.isStyleLoaded()) {
      syncMarkers();
      return;
    }

    map.once('load', syncMarkers);
  }, [markers, showPopups, mapReadyVersion]);

  useEffect(() => {
    mapRef.current?.resize();
  }, [height]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: '100%' }}
      aria-label="Карта инициатив"
    />
  );
}
