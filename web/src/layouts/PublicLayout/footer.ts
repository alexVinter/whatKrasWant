import partnerAdministration from '../../shared/brand/partners/administration.png';
import partnerArtstyle from '../../shared/brand/partners/artstyle.svg';
import partnerDelovayaRossiya from '../../shared/brand/partners/delovaya-rossiya.svg';
import partnerEnisib from '../../shared/brand/partners/enisib.png';
import partnerGorodDlyaPeshekhodov from '../../shared/brand/partners/gorod_dlya_peshekhodov.svg';
import partnerMoyKrasnoyarsk from '../../shared/brand/partners/moy-krasnoyarsk.png';
import partnerProjectdevelopment from '../../shared/brand/partners/projectdevelopment.svg';

export const FOOTER_SUPPORT_PREFIX = 'Проект реализуется при поддержке';

export const FOOTER_SUPPORT_ORG =
  'АНО „Краевой центр поддержки и развития общественных инициатив“';

export const FOOTER_SUPPORT_PHRASE = `${FOOTER_SUPPORT_PREFIX} ${FOOTER_SUPPORT_ORG}`;

export const FOOTER_EMAIL = 'vvv@fond.ensib.ru';

export const FOOTER_USEFUL_LINKS = [
  'Правила модерации',
  'Политика обработки персональных данных',
] as const;

export type FooterPartnerTheme = 'light' | 'dark';

export interface FooterPartner {
  id: string;
  name: string;
  src: string;
  theme?: FooterPartnerTheme;
}

export const FOOTER_PARTNERS: FooterPartner[] = [
  {
    id: 'krasnoyarsk-admin',
    name: 'Администрация города Красноярска',
    src: partnerAdministration,
  },
  {
    id: 'delovaya-rossiya',
    name: 'Деловая Россия',
    src: partnerDelovayaRossiya,
  },
  { id: 'artstyle', name: 'ArtStyle', src: partnerArtstyle },
  {
    id: 'gorod-dlya-peshekhodov',
    name: 'Город для пешеходов',
    src: partnerGorodDlyaPeshekhodov,
  },
  {
    id: 'project-development',
    name: 'Проект Девелопмент',
    src: partnerProjectdevelopment,
    theme: 'dark',
  },
  {
    id: 'yenisei-siberia',
    name: 'Енисейская Сибирь',
    src: partnerEnisib,
    theme: 'dark',
  },
  {
    id: 'tv7',
    name: '7 канал',
    src: partnerMoyKrasnoyarsk,
    theme: 'dark',
  },
];
