import heroComposition from '../../shared/brand/k400-stolby-hero-official.png';
import newsPhoto1 from '../../shared/brand/mockup/news/photo-1.png';
import newsPhoto2 from '../../shared/brand/mockup/news/photo-2.png';
import newsPhoto3 from '../../shared/brand/mockup/news/photo-3.png';
import ratingMap1 from '../../shared/brand/mockup/rating/map-1.png';
import ratingMap2 from '../../shared/brand/mockup/rating/map-2.png';
import ratingMap3 from '../../shared/brand/mockup/rating/map-3.png';
import ratingMap4 from '../../shared/brand/mockup/rating/map-4.png';

export { heroComposition };

export interface MockRatingCard {
  rank: number;
  previewImage: string;
  authorName: string;
  title: string;
  description: string;
  voteCount: number;
}

export interface MockNewsCard {
  image: string;
  dateLabel: string;
  title: string;
}

/** Visual placeholders from approved desktop mockup (`01-home.png`). */
export const MOCK_RATING_CARDS: MockRatingCard[] = [
  {
    rank: 1,
    previewImage: ratingMap1,
    authorName: 'Имя Фамилия',
    title: 'Арт-объект «Слияние» на Стрелке',
    description:
      'Скульптурная композиция на слиянии Енисея и Качи, которая станет новой точкой притяжения для жителей и гостей города.',
    voteCount: 345,
  },
  {
    rank: 2,
    previewImage: ratingMap2,
    authorName: 'Имя Фамилия',
    title: 'Пешеходный проспект Мира по выходным',
    description:
      'В выходные дни центральная улица закрывается для машин, чтобы на проспекте появились прогулки, ярмарки и уличные события.',
    voteCount: 198,
  },
  {
    rank: 3,
    previewImage: ratingMap3,
    authorName: 'Имя Фамилия',
    title: 'Выделенная полоса на ул. Партизана Железняка',
    description:
      'Отдельная полоса для общественного транспорта сократит время в пути и сделает поездки по району предсказуемее.',
    voteCount: 173,
  },
  {
    rank: 4,
    previewImage: ratingMap4,
    authorName: 'Имя Фамилия',
    title: 'Маршрут вдоль поймы реки Кача',
    description:
      'Непрерывный прогулочный маршрут вдоль реки с освещением, лавочками и удобными спусками к воде.',
    voteCount: 156,
  },
];

export const MOCK_NEWS_CARDS: MockNewsCard[] = [
  {
    image: newsPhoto1,
    dateLabel: 'Дата публикации',
    title: 'Название новости',
  },
  {
    image: newsPhoto2,
    dateLabel: 'Дата публикации',
    title: 'Название новости',
  },
  {
    image: newsPhoto3,
    dateLabel: 'Дата публикации',
    title: 'Название новости',
  },
];
