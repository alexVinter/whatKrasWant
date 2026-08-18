import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

class MockMap {
  on(event: string, handler: () => void) {
    if (event === 'load') {
      queueMicrotask(handler);
    }
    return this;
  }

  once(event: string, handler: () => void) {
    return this.on(event, handler);
  }

  remove() {}

  resize() {}

  setCenter() {}

  setZoom() {}

  fitBounds() {}

  addControl() {}

  isStyleLoaded() {
    return true;
  }
}

class MockMarker {
  setLngLat() {
    return this;
  }

  setPopup() {
    return this;
  }

  addTo() {
    return this;
  }

  remove() {}
}

class MockPopup {
  setDOMContent() {
    return this;
  }
}

class MockNavigationControl {}

class MockResizeObserver {
  observe = vi.fn();

  disconnect = vi.fn();

  unobserve = vi.fn();
}

class MockIntersectionObserver {
  observe = vi.fn(() => {
    queueMicrotask(() => {
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    });
  });

  disconnect = vi.fn();

  unobserve = vi.fn();

  constructor(private callback: IntersectionObserverCallback) {}

  takeRecords() {
    return [];
  }
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

class MockLngLatBounds {
  extend() {
    return this;
  }
}

vi.mock('maplibre-gl', () => ({
  Map: MockMap,
  Marker: MockMarker,
  Popup: MockPopup,
  NavigationControl: MockNavigationControl,
  LngLatBounds: MockLngLatBounds,
  setWorkerUrl: vi.fn(),
  default: {
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    NavigationControl: MockNavigationControl,
    LngLatBounds: MockLngLatBounds,
    setWorkerUrl: vi.fn(),
  },
}));

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({
  default: '/mock-maplibre-worker.js',
}));

afterEach(() => {
  cleanup();
});
