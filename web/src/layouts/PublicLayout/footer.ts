export const FOOTER_SUPPORT_PHRASE =
  'Проект реализуется при поддержке АНО „Краевой центр поддержки и развития общественных инициатив“';

export const FOOTER_EMAIL = 'vvv@fond.ensib.ru';

export const FOOTER_USEFUL_LINKS = [
  'Правила модерации',
  'Политика обработки персональных данных',
] as const;

export interface FooterPartner {
  id: string;
  name: string;
  src: string | null;
}

/**
 * Official partner logo files were not found in the repository.
 * Do not invent marks or fall back to visible names.
 * When a real asset is added, set `src` and the footer will render the image.
 */
export const FOOTER_PARTNERS: FooterPartner[] = [
  { id: 'tv7', name: '7 канал', src: null },
  { id: 'yenisei-siberia', name: 'Енисейская Сибирь', src: null },
  { id: 'delovaya-rossiya', name: 'Деловая Россия', src: null },
  { id: 'artstyle', name: 'ArtStyle', src: null },
  { id: 'project-development', name: 'Проект Девелопмент', src: null },
  { id: 'krasnoyarsk-admin', name: 'Администрация города Красноярска', src: null },
];
