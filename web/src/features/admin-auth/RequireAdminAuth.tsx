import { Navigate, Outlet } from 'react-router-dom';
import { FullscreenLoader } from '../../shared/ui/FullscreenLoader';
import { useAdminSession } from './useAdminSession';

export function RequireAdminAuth() {
  const { data, isLoading, isError } = useAdminSession();

  if (isLoading) {
    return <FullscreenLoader />;
  }

  if (isError || !data) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
