import type { PublicMapIdea } from '../../features/public-ideas/types';

export function createIdeaPopupElement(marker: PublicMapIdea): HTMLDivElement {
  const popupNode = document.createElement('div');
  popupNode.className = 'idea-map-popup';

  if (marker.thumbnailUrl) {
    const imageWrap = document.createElement('span');
    imageWrap.className = 'idea-map-popupImageWrap';
    const image = document.createElement('img');
    image.className = 'idea-map-popupImage';
    image.src = marker.thumbnailUrl;
    image.alt = '';
    imageWrap.append(image);
    popupNode.append(imageWrap);
  } else {
    const imageWrap = document.createElement('span');
    imageWrap.className = 'idea-map-popupImageWrap';
    const fallback = document.createElement('span');
    fallback.className = 'idea-map-popupImageFallback';
    imageWrap.append(fallback);
    popupNode.append(imageWrap);
  }

  const body = document.createElement('div');
  body.className = 'idea-map-popupBody';

  const author = document.createElement('p');
  author.className = 'idea-map-popupAuthor';
  author.textContent = `Автор: ${marker.authorName}`;

  const title = document.createElement('p');
  title.className = 'idea-map-popupTitle';
  title.textContent = marker.title;

  const link = document.createElement('a');
  link.className = 'idea-map-popupLink';
  link.href = `/initiatives/${marker.slug}`;
  link.textContent = 'Подробнее';

  body.append(author, title, link);
  popupNode.append(body);

  return popupNode;
}
