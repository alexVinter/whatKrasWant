import { BrandLogo } from '../../shared/ui/BrandLogo';
import {
  FOOTER_EMAIL,
  FOOTER_PARTNERS,
  FOOTER_SUPPORT_PHRASE,
  FOOTER_USEFUL_LINKS,
} from './footer';
import styles from './PublicFooter.module.css';

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerLogo}>
          <BrandLogo variant="footer" />
        </div>

        <div>
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

        <div>
          <h2 className={styles.footerTitle}>Партнёры</h2>
          <ul className={styles.partners}>
            {FOOTER_PARTNERS.map((partner) => (
              <li key={partner.id} className={styles.partner} aria-label={partner.name}>
                <img className={styles.partnerLogo} src={partner.src} alt="" />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className={styles.footerTitle}>Контакты</h2>
          <p className={styles.contactLabel}>Электронная почта:</p>
          <p className={styles.contact}>{FOOTER_EMAIL}</p>
        </div>
      </div>
    </footer>
  );
}
