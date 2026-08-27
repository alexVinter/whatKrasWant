import {
  FOOTER_EMAIL,
  FOOTER_PARTNERS,
  FOOTER_SUPPORT_PHRASE,
  FOOTER_USEFUL_LINKS,
} from './footer';
import styles from './PublicFooter.module.css';

const SKYLINE_SRC = '/images/footer/krasnoyarsk-skyline.png';

const LIGHT_PARTNERS = FOOTER_PARTNERS.filter((partner) => partner.theme !== 'dark');
const DARK_PARTNERS = FOOTER_PARTNERS.filter((partner) => partner.theme === 'dark');

function PartnerCard({
  name,
  src,
  theme,
}: (typeof FOOTER_PARTNERS)[number]) {
  return (
    <li
      className={`${styles.partner} ${theme === 'dark' ? styles.partnerDark : ''}`}
      aria-label={name}
    >
      <img className={styles.partnerLogo} src={src} alt="" />
    </li>
  );
}

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={`${styles.section} ${styles.sectionLinks}`}>
          <h2 className={styles.footerTitle}>Полезные ссылки</h2>
          <ul className={styles.footerList}>
            {FOOTER_USEFUL_LINKS.map((label) => (
              <li key={label}>
                <span className={styles.footerLink}>{label}</span>
              </li>
            ))}
          </ul>
          <p className={styles.support}>{FOOTER_SUPPORT_PHRASE}</p>
        </div>

        <div className={`${styles.section} ${styles.sectionPartners}`}>
          <h2 className={styles.footerTitle}>Партнёры</h2>
          <div className={styles.partnersLayout}>
            <ul className={`${styles.partnersRow} ${styles.partnersRowLight}`}>
              {LIGHT_PARTNERS.map((partner) => (
                <PartnerCard key={partner.id} {...partner} />
              ))}
            </ul>
            <ul className={`${styles.partnersRow} ${styles.partnersRowDark}`}>
              {DARK_PARTNERS.map((partner) => (
                <PartnerCard key={partner.id} {...partner} />
              ))}
            </ul>
          </div>
        </div>

        <div className={`${styles.section} ${styles.sectionContacts}`}>
          <h2 className={styles.footerTitle}>Контакты</h2>
          <p className={styles.contactLabel}>Электронная почта:</p>
          <p className={styles.contact}>{FOOTER_EMAIL}</p>
        </div>

        <div className={styles.skyline} aria-hidden="true">
          <img className={styles.skylineImage} src={SKYLINE_SRC} alt="" />
        </div>
      </div>
    </footer>
  );
}
