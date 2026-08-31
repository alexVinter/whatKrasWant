import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import logoWhite from './k400-logo-horizontal-white.svg';
import { SubmitIdeaCta } from '../../features/public-submission/SubmitIdeaCta';
import { useActiveHomeSection } from '../../shared/motion/useActiveHomeSection';
import { scrollToHomeSection } from '../../shared/motion/scrollToHomeSection';
import styles from './PublicHeader.module.css';

function sectionHref(id: string, onHome: boolean): string {
  return onHome ? `#${id}` : `/#${id}`;
}

interface SubmitHeaderCtaProps {
  className: string;
  onNavigate?: () => void;
}

function SubmitHeaderCta({ className, onNavigate }: SubmitHeaderCtaProps) {
  return <SubmitIdeaCta className={className} onNavigate={onNavigate} />;
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
  const onHome = location.pathname === '/';
  const newsActive = location.pathname.startsWith('/news');
  const initiativesActive = location.pathname.startsWith('/initiatives');
  const activeHomeSection = useActiveHomeSection(onHome);

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
      <div className={styles.headerShell}>
        <header className={styles.header}>
          <div className={styles.headerBrand}>
            <img
              className={styles.headerDecor}
              src="/images/header/header-left-wide.png"
              alt=""
              aria-hidden="true"
              decoding="async"
            />
            <div className={styles.logoMark}>
              <img
                className={styles.logoImg}
                src={logoWhite}
                alt="400 лет Красноярску"
                decoding="async"
              />
            </div>
          </div>
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
          <SubmitHeaderCta className={styles.cta} />
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
              className={styles.mobileCta}
              onNavigate={onCloseMenu}
            />
          </div>
        )}
      </div>
      <div className={styles.headerDivider} aria-hidden="true" />
    </>
  );
}
