import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '../../shared/ui/BrandLogo';
import { usePublicConfig } from '../../features/public-config/queries';
import { useActiveHomeSection } from '../../shared/motion/useActiveHomeSection';
import { scrollToHomeSection } from '../../shared/motion/scrollToHomeSection';
import styles from './PublicHeader.module.css';

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

interface PublicHeaderProps {
  menuOpen: boolean;
  onMenuToggle: () => void;
  onCloseMenu: () => void;
}

export function PublicHeader({ menuOpen, onMenuToggle, onCloseMenu }: PublicHeaderProps) {
  const location = useLocation();
  const configQuery = usePublicConfig();
  const onHome = location.pathname === '/';
  const newsActive = location.pathname.startsWith('/news');
  const initiativesActive = location.pathname.startsWith('/initiatives');
  const activeHomeSection = useActiveHomeSection(onHome);

  const features = configQuery.data?.features;
  const submissionEnabled = features?.PUBLIC_SUBMISSION ?? false;

  useEffect(() => {
    if (!onHome || !location.hash) {
      return;
    }
    const sectionId = location.hash.replace('#', '');
    if (!sectionId) {
      return;
    }
    requestAnimationFrame(() => scrollToHomeSection(sectionId));
  }, [location.hash, onHome]);

  const navClassName = (item: (typeof NAV_ITEMS)[number]) => {
    const hash = location.hash;
    const active = onHome
      ? activeHomeSection === item.id
      : (item.id === 'news' && newsActive) ||
        (item.id === 'rating' && initiativesActive) ||
        (item.id === 'map' && onHome && hash === '#map') ||
        (item.id === 'project' && onHome && (hash === '' || hash === '#project'));
    return `${styles.navLink} ${active ? styles.navLinkActive : ''}`;
  };

  const handleSectionNav = (
    event: React.MouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) => {
    if (!onHome) {
      return;
    }
    event.preventDefault();
    scrollToHomeSection(sectionId);
    onCloseMenu();
    window.history.replaceState(null, '', `#${sectionId}`);
  };

  return (
    <>
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
              onClick={(event) => handleSectionNav(event, item.id)}
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
          onClick={onMenuToggle}
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
              onClick={(event) => handleSectionNav(event, item.id)}
            >
              {item.label}
            </a>
          ))}
          <SubmitHeaderCta
            enabled={submissionEnabled}
            className={styles.mobileCta}
            onNavigate={onCloseMenu}
          />
        </div>
      )}
    </>
  );
}
