import type { Map, Popup } from 'maplibre-gl';

const MOBILE_POPUP_MQ = '(max-width: 767px)';
const MOBILE_POPUP_EDGE_PADDING = 20;

export function isMobileMapPopupViewport(): boolean {
  return window.matchMedia(MOBILE_POPUP_MQ).matches;
}

export function createIdeaMapPopupOptions(): ConstructorParameters<typeof Popup>[0] {
  const mobile = isMobileMapPopupViewport();

  return {
    offset: mobile ? 16 : 24,
    closeButton: false,
    maxWidth: mobile ? 'calc(100vw - 40px)' : '505px',
    className: 'idea-map-popup-shell',
  };
}

export function bindMobileIdeaMapPopupClamp(popup: Popup, map: Map): void {
  popup.on('open', () => {
    if (!isMobileMapPopupViewport()) {
      return;
    }

    requestAnimationFrame(() => {
      const popupElement = popup.getElement();
      if (!popupElement) {
        return;
      }

      popupElement.style.marginLeft = '0px';

      const mapRect = map.getContainer().getBoundingClientRect();
      const popupRect = popupElement.getBoundingClientRect();
      let shiftX = 0;

      if (popupRect.left < mapRect.left + MOBILE_POPUP_EDGE_PADDING) {
        shiftX = mapRect.left + MOBILE_POPUP_EDGE_PADDING - popupRect.left;
      } else if (popupRect.right > mapRect.right - MOBILE_POPUP_EDGE_PADDING) {
        shiftX = mapRect.right - MOBILE_POPUP_EDGE_PADDING - popupRect.right;
      }

      if (shiftX !== 0) {
        popupElement.style.marginLeft = `${shiftX}px`;
      }
    });
  });

  popup.on('close', () => {
    popup.getElement()?.style.removeProperty('margin-left');
  });
}
