import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logoutAdmin } from '../../features/admin-auth/api';
import { ADMIN_SESSION_QUERY_KEY } from '../../features/admin-auth/useAdminSession';
import { BrandLogo } from '../../shared/ui/BrandLogo';
import styles from './AdminLayout.module.css';

interface NavItem {
  label: string;
  to?: string;
  end?: boolean;
}

// Approved admin navigation. Only "Обзор" is a real route in E04; the other
// sections are shown per the mockup but are not yet implemented.
const NAV_ITEMS: NavItem[] = [
  { label: 'Обзор', to: '/admin', end: true },
  { label: 'Инициативы' },
  { label: 'Создать инициативу' },
  { label: 'Категории и районы' },
  { label: 'Новости' },
  { label: 'Статистика и выгрузка' },
  { label: 'Настройки' },
  { label: 'Журнал действий' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

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
          <span className={styles.topbarSection}>Обзор</span>
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
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
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
