import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logoutAdmin } from '../../features/admin-auth/api';
import { ADMIN_SESSION_QUERY_KEY } from '../../features/admin-auth/useAdminSession';
import { BrandLogo } from '../../shared/ui/BrandLogo';
import styles from './AdminLayout.module.css';

interface NavItem {
  label: string;
  to?: string;
  end?: boolean;
  match?: (pathname: string) => boolean;
}

// Approved admin navigation. Sections without a `to` are shown per the mockup
// but are not implemented yet.
const NAV_ITEMS: NavItem[] = [
  { label: 'Обзор', to: '/admin', end: true },
  {
    label: 'Инициативы',
    to: '/admin/initiatives',
    match: (pathname) =>
      pathname === '/admin/initiatives' ||
      (pathname.startsWith('/admin/initiatives/') &&
        pathname !== '/admin/initiatives/new'),
  },
  { label: 'Создать инициативу', to: '/admin/initiatives/new', end: true },
  { label: 'Категории и районы', to: '/admin/taxonomy' },
  { label: 'Новости' },
  { label: 'Статистика и выгрузка', to: '/admin/statistics' },
  { label: 'Настройки', to: '/admin/settings' },
  { label: 'Журнал действий', to: '/admin/audit' },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (!item.to) {
    return false;
  }
  if (item.match) {
    return item.match(pathname);
  }
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeSection =
    NAV_ITEMS.find((item) => isItemActive(item, location.pathname))?.label ??
    'Обзор';

  const logout = useMutation({
    mutationFn: logoutAdmin,
    onSettled: () => {
      queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, null);
      queryClient.removeQueries({ queryKey: ADMIN_SESSION_QUERY_KEY });
      navigate('/admin/login', { replace: true });
    },
  });

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={styles.layout}>
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          <span className={styles.topbarLogo}>
            <BrandLogo variant="topbar" />
          </span>
          <span className={styles.topbarSection}>{activeSection}</span>
        </div>
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
        <div className={styles.backdrop} aria-hidden="true" onClick={closeMenu} />
      )}

      <aside
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.sidebarLogo}>
          <BrandLogo variant="sidebar" />
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                onClick={closeMenu}
                className={() =>
                  `${styles.navItem} ${
                    isItemActive(item, location.pathname)
                      ? styles.navItemActive
                      : ''
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.label}
                className={`${styles.navItem} ${styles.navItemDisabled}`}
                aria-disabled="true"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>

        <button
          type="button"
          className={styles.logout}
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Выйти
        </button>
      </aside>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
