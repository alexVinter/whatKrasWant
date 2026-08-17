import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { loginAdmin } from '../../../features/admin-auth/api';
import {
  ADMIN_SESSION_QUERY_KEY,
  useAdminSession,
} from '../../../features/admin-auth/useAdminSession';
import { BrandLogo } from '../../../shared/ui/BrandLogo';
import { FullscreenLoader } from '../../../shared/ui/FullscreenLoader';
import styles from './AdminLoginPage.module.css';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAdminSession();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => loginAdmin({ login, password }),
    onSuccess: (data) => {
      queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, data);
      navigate('/admin', { replace: true });
    },
  });

  if (session.isLoading) {
    return <FullscreenLoader />;
  }

  if (session.data) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <BrandLogo variant="login" />
        </div>
        <h1 className={styles.title}>Вход администратора</h1>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="admin-login">
              Логин
            </label>
            <input
              id="admin-login"
              name="login"
              className={styles.input}
              type="text"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              disabled={mutation.isPending}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="admin-password">
              Пароль
            </label>
            <input
              id="admin-password"
              name="password"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={mutation.isPending}
              required
            />
          </div>

          {mutation.isError && (
            <p className={styles.error} role="alert">
              Неверный логин или пароль
            </p>
          )}

          <button
            type="submit"
            className={styles.submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
