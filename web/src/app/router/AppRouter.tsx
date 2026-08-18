import { Route, Routes } from 'react-router-dom';
import { RequireAdminAuth } from '../../features/admin-auth/RequireAdminAuth';
import { AdminLayout } from '../../layouts/AdminLayout/AdminLayout';
import { PublicLayout } from '../../layouts/PublicLayout/PublicLayout';
import { PublicHomePage } from '../../pages/PublicHomePage/PublicHomePage';
import { PublicInitiativesPage } from '../../pages/public/PublicInitiativesPage/PublicInitiativesPage';
import { PublicInitiativeDetailPage } from '../../pages/public/PublicInitiativeDetailPage/PublicInitiativeDetailPage';
import { PublicNewsPage } from '../../pages/public/PublicNewsPage/PublicNewsPage';
import { PublicNewsDetailPage } from '../../pages/public/PublicNewsDetailPage/PublicNewsDetailPage';
import { AdminLoginPage } from '../../pages/admin/AdminLoginPage/AdminLoginPage';
import { AdminOverviewPage } from '../../pages/admin/AdminOverviewPage/AdminOverviewPage';
import { AdminTaxonomyPage } from '../../pages/admin/AdminTaxonomyPage/AdminTaxonomyPage';
import { AdminInitiativesPage } from '../../pages/admin/AdminInitiativesPage/AdminInitiativesPage';
import { AdminInitiativeCreatePage } from '../../pages/admin/AdminInitiativeCreatePage/AdminInitiativeCreatePage';
import { AdminInitiativeEditPage } from '../../pages/admin/AdminInitiativeEditPage/AdminInitiativeEditPage';
import { AdminAuditPage } from '../../pages/admin/AdminAuditPage/AdminAuditPage';
import { AdminSettingsPage } from '../../pages/admin/AdminSettingsPage/AdminSettingsPage';
import { AdminStatisticsPage } from '../../pages/admin/AdminStatisticsPage/AdminStatisticsPage';
import { AdminNewsPage } from '../../pages/admin/AdminNewsPage/AdminNewsPage';
import { AdminNewsFormPage } from '../../pages/admin/AdminNewsFormPage/AdminNewsFormPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<PublicHomePage />} />
        <Route path="/news" element={<PublicNewsPage />} />
        <Route path="/news/:slug" element={<PublicNewsDetailPage />} />
        <Route path="/initiatives" element={<PublicInitiativesPage />} />
        <Route path="/initiatives/:slug" element={<PublicInitiativeDetailPage />} />
      </Route>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAdminAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="taxonomy" element={<AdminTaxonomyPage />} />
          <Route path="initiatives" element={<AdminInitiativesPage />} />
          <Route path="initiatives/new" element={<AdminInitiativeCreatePage />} />
          <Route path="initiatives/:id" element={<AdminInitiativeEditPage />} />
          <Route path="news" element={<AdminNewsPage />} />
          <Route path="news/new" element={<AdminNewsFormPage />} />
          <Route path="news/:id" element={<AdminNewsFormPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="statistics" element={<AdminStatisticsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
