import { useEffect, useState } from 'react';
import { initVkSdk } from '../../../features/public-auth/vkSdk';
import {
  usePublicAuthActions,
  usePublicSession,
} from '../../../features/public-auth/usePublicAuth';
import styles from './PublicAuthTestPage.module.css';

export function PublicAuthTestPage() {
  const sessionQuery = usePublicSession();
  const { loginMutation, logoutMutation } = usePublicAuthActions();
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    try {
      initVkSdk();
    } catch (error) {
      setInitError(
        error instanceof Error ? error.message : 'VK SDK initialization failed',
      );
    }
  }, []);

  const actionError =
    loginMutation.error instanceof Error
      ? loginMutation.error.message
      : logoutMutation.error instanceof Error
        ? logoutMutation.error.message
        : null;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Тест VK ID авторизации</h1>
      <p className={styles.note}>
        Служебная страница Release 2. Не связана с публичной навигацией и не
        включает подачу инициатив или голосование.
      </p>

      <div className={styles.card}>
        {sessionQuery.isLoading ? <p>Загрузка сессии…</p> : null}

        {initError ? <p className={styles.error}>{initError}</p> : null}

        {sessionQuery.data?.authenticated ? (
          <>
            <p className={styles.profileName}>
              {sessionQuery.data.user.firstName} {sessionQuery.data.user.lastName}
            </p>
            <button
              type="button"
              className={styles.button}
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              Выйти
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.button}
            disabled={loginMutation.isPending || Boolean(initError)}
            onClick={() => loginMutation.mutate()}
          >
            Войти через VK ID
          </button>
        )}

        {actionError ? <p className={styles.error}>{actionError}</p> : null}
      </div>
    </main>
  );
}
