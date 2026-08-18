import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BrandLogo } from '../../shared/ui/BrandLogo';
import { usePublicConfig } from '../../features/public-config/queries';
import {
  FOOTER_EMAIL,
  FOOTER_PARTNERS,
  FOOTER_SUPPORT_PHRASE,
  FOOTER_USEFUL_LINKS,
} from './footer';
import styles from './PublicLayout.module.css';

function sectionHref(id: string, onHome: boolean): string {
  return onHome ? `#${id}` : `/#${id}`;
}

interface SubmitHeaderCtaProps {
  enabled: boolean;
  className: string;
  onNavigate?: () => void;
}

function SubmitHeaderCta({ enabled, className, onNavigate }: SubmitHeaderCtaProps) {
  if (enabled) {
    return (
      <Link to="/submit" className={className} onClick={onNavigate}>
        Предложить идею
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      disabled
      aria-disabled="true"
      onClick={onNavigate}
    >
      Предложить идею
    </button>
  );
}

const NAV_ITEMS = [
  { label: 'О проекте', id: 'project' },
  { label: 'Карта', id: 'map' },
  { label: 'Рейтинг инициатив', id: 'rating' },
  { label: 'Новости', id: 'news' },
] as const;

export function PublicLayout() {
  const location = useLocation();
  const configQuery = usePublicConfig();
  const [menuOpen, setMenuOpen] = useState(false);
  const onHome = location.pathname === '/';
  const newsActive = location.pathname.startsWith('/news');
  const initiativesActive = location.pathname.startsWith('/initiatives');

  const features = configQuery.data?.features;
  const submissionEnabled = features?.PUBLIC_SUBMISSION ?? false;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const closeMenu = () => setMenuOpen(false);

  const navClassName = (item: (typeof NAV_ITEMS)[number]) => {
    const hash = location.hash;
    const active =
      (item.id === 'news' && (newsActive || (onHome && hash === '#news'))) ||
      (item.id === 'map' && onHome && hash === '#map') ||
      (item.id === 'rating' && onHome && hash === '#rating') ||
      (item.id === 'project' &&
        onHome &&
        (hash === '' || hash === '#project'));
    return `${styles.navLink} ${active ? styles.navLinkActive : ''}`;
  };

  return (
    <div className={styles.shell}>
      <div className={styles.topStripe} aria-hidden="true" />
      <header className={styles.header}>
        <Link to="/" className={styles.logoLink} aria-label="На главную">
          <BrandLogo variant="public" />
        </Link>
        <nav className={styles.desktopNav} aria-label="Разделы">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={sectionHref(item.id, onHome)}
              className={navClassName(item)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <SubmitHeaderCta enabled={submissionEnabled} className={styles.cta} />
        <button
          type="button"
          className={styles.burger}
          aria-label="Меню"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>
      <div className={styles.headerDivider} aria-hidden="true" />

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={sectionHref(item.id, onHome)}
              className={styles.mobileNavLink}
              onClick={closeMenu}
            >
              {item.label}
            </a>
          ))}
          <SubmitHeaderCta
            enabled={submissionEnabled}
            className={styles.mobileCta}
            onNavigate={closeMenu}
          />
        </div>
      )}

      <div
        className={`${styles.content} ${onHome ? styles.contentHome : ''} ${
          initiativesActive ? styles.contentWide : ''
        }`}
      >
        <Outlet />
      </div>

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
    </div>
  );
}
