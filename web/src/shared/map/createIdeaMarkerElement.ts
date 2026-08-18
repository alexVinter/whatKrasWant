export function createIdeaMarkerElement(): HTMLSpanElement {
  const marker = document.createElement('span');
  marker.className = 'idea-map-marker';
  marker.setAttribute('aria-hidden', 'true');
  marker.innerHTML = '<span></span>';
  return marker;
}
