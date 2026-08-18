import partnerArtstyle from '../../shared/brand/mockup/partners/artstyle.png';
import partnerDelovayaRossiya from '../../shared/brand/mockup/partners/delovaya-rossiya.png';
import partnerKrasnoyarskAdmin from '../../shared/brand/mockup/partners/krasnoyarsk-admin.png';
import partnerProjectDevelopment from '../../shared/brand/mockup/partners/project-development.png';
import partnerTv7 from '../../shared/brand/mockup/partners/tv7.png';
import partnerYeniseiSiberia from '../../shared/brand/mockup/partners/yenisei-siberia.png';

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
  src: string;
}

export const FOOTER_PARTNERS: FooterPartner[] = [
  { id: 'tv7', name: '7 канал', src: partnerTv7 },
  { id: 'yenisei-siberia', name: 'Енисейская Сибирь', src: partnerYeniseiSiberia },
  { id: 'delovaya-rossiya', name: 'Деловая Россия', src: partnerDelovayaRossiya },
  { id: 'artstyle', name: 'ArtStyle', src: partnerArtstyle },
  { id: 'project-development', name: 'Проект Девелопмент', src: partnerProjectDevelopment },
  {
    id: 'krasnoyarsk-admin',
    name: 'Администрация города Красноярска',
    src: partnerKrasnoyarskAdmin,
  },
];
