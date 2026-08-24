import { BrandLogo } from '../../shared/ui/BrandLogo';
import {
  FOOTER_EMAIL,
  FOOTER_PARTNERS,
  FOOTER_SUPPORT_PHRASE,
  FOOTER_USEFUL_LINKS,
} from './footer';
import styles from './PublicFooter.module.css';

const SKYLINE_SRC = '/images/footer/krasnoyarsk-skyline.png';

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.logoColumn}>
          <div className={styles.footerLogo}>
            <BrandLogo variant="footer" />
          </div>
        </div>

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
          <ul className={styles.partners}>
            {FOOTER_PARTNERS.map((partner) => (
              <li key={partner.id} className={styles.partner} aria-label={partner.name}>
                <img className={styles.partnerLogo} src={partner.src} alt="" />
              </li>
            ))}
          </ul>
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
