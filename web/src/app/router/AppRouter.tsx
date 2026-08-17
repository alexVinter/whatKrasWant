import { Route, Routes } from 'react-router-dom';
import { RequireAdminAuth } from '../../features/admin-auth/RequireAdminAuth';
import { AdminLayout } from '../../layouts/AdminLayout/AdminLayout';
import { PublicHomePage } from '../../pages/PublicHomePage/PublicHomePage';
import { AdminLoginPage } from '../../pages/admin/AdminLoginPage/AdminLoginPage';
import { AdminOverviewPage } from '../../pages/admin/AdminOverviewPage/AdminOverviewPage';
import { AdminTaxonomyPage } from '../../pages/admin/AdminTaxonomyPage/AdminTaxonomyPage';
import { AdminInitiativesPage } from '../../pages/admin/AdminInitiativesPage/AdminInitiativesPage';
import { AdminInitiativeCreatePage } from '../../pages/admin/AdminInitiativeCreatePage/AdminInitiativeCreatePage';
import { AdminInitiativeEditPage } from '../../pages/admin/AdminInitiativeEditPage/AdminInitiativeEditPage';
import { AdminAuditPage } from '../../pages/admin/AdminAuditPage/AdminAuditPage';
import { AdminSettingsPage } from '../../pages/admin/AdminSettingsPage/AdminSettingsPage';
import { AdminStatisticsPage } from '../../pages/admin/AdminStatisticsPage/AdminStatisticsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PublicHomePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAdminAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="taxonomy" element={<AdminTaxonomyPage />} />
          <Route path="initiatives" element={<AdminInitiativesPage />} />
          <Route path="initiatives/new" element={<AdminInitiativeCreatePage />} />
          <Route path="initiatives/:id" element={<AdminInitiativeEditPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="statistics" element={<AdminStatisticsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
