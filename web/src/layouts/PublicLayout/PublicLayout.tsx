import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BrandLogo } from '../../shared/ui/BrandLogo';
import {
  FOOTER_EMAIL,
  FOOTER_PARTNERS,
  FOOTER_SUPPORT_PHRASE,
  FOOTER_USEFUL_LINKS,
} from './footer';
import styles from './PublicLayout.module.css';

const NAV = [
  { label: 'О проекте', to: '/' },
  { label: 'Карта', to: '/' },
  { label: 'Рейтинг инициатив', to: '/' },
  { label: 'Новости', to: '/news' },
];

export function PublicLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const newsActive = location.pathname.startsWith('/news');

  return (
    <div className={styles.shell}>
      <div className={styles.topStripe} aria-hidden="true" />
      <header className={styles.header}>
        <Link to="/" className={styles.logoLink} aria-label="На главную">
          <BrandLogo variant="public" />
        </Link>
        <nav className={styles.desktopNav} aria-label="Разделы">
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={() =>
                `${styles.navLink} ${
                  item.to === '/news' && newsActive ? styles.navLinkActive : ''
                }`
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className={styles.cta}>
          Предложить идею
        </Link>
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

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={styles.mobileNavLink}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/"
            className={styles.mobileCta}
            onClick={() => setMenuOpen(false)}
          >
            Предложить идею
          </Link>
        </div>
      )}

      <div className={styles.content}>
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
                <li
                  key={partner.id}
                  className={styles.partner}
                  aria-label={partner.name}
                >
                  {partner.src ? (
                    <img
                      className={styles.partnerLogo}
                      src={partner.src}
                      alt=""
                    />
                  ) : null}
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
