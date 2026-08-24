import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import styles from './PublicLayout.module.css';

export function PublicLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const onHome = location.pathname === '/';
  const initiativesActive = location.pathname.startsWith('/initiatives');

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <div className={styles.shell}>
      <PublicHeader
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <div
        className={`${styles.content} ${onHome ? styles.contentHome : ''} ${
          initiativesActive ? styles.contentWide : ''
        }`}
      >
        <Outlet />
      </div>

      <PublicFooter />
    </div>
  );
}
