import { Route, Routes } from 'react-router-dom';
import { RequireAdminAuth } from '../../features/admin-auth/RequireAdminAuth';
import { AdminLayout } from '../../layouts/AdminLayout/AdminLayout';
import { PublicHomePage } from '../../pages/PublicHomePage/PublicHomePage';
import { AdminLoginPage } from '../../pages/admin/AdminLoginPage/AdminLoginPage';
import { AdminOverviewPage } from '../../pages/admin/AdminOverviewPage/AdminOverviewPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PublicHomePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAdminAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
