import { useEffect, useState } from 'react';
import {
  useAdminSettings,
  useUpdateAdminSettings,
} from '../../../features/settings/queries';
import { humanizeSettingsError } from '../../../features/settings/errors';
import {
  FEATURE_FLAG_KEYS,
  type AdminSettings,
  type FeatureFlagKey,
} from '../../../features/settings/types';
import styles from './AdminSettingsPage.module.css';

const FLAG_ROWS: {
  key: FeatureFlagKey;
  title: string;
  description: string;
}[] = [
  {
    key: 'PUBLIC_CATALOG',
    title: 'Публичная карта и инициативы',
    description: 'Открывает публичную карту и страницы инициатив.',
  },
  {
    key: 'PUBLIC_SUBMISSION',
    title: 'Приём инициатив',
    description: 'Разрешает отправку идеи после VK-авторизации.',
  },
  {
    key: 'VOTING',
    title: 'Голосование',
    description: 'Разрешает поддержку инициатив.',
  },
  {
    key: 'RESULTS',
    title: 'Рейтинг инициатив',
    description: 'Показывает рейтинг по действительным голосам.',
  },
];

function flagsEqual(a: AdminSettings, b: AdminSettings): boolean {
  return FEATURE_FLAG_KEYS.every((key) => a[key] === b[key]);
}

export function AdminSettingsPage() {
  const query = useAdminSettings();
  const mutation = useUpdateAdminSettings();
  const [draft, setDraft] = useState<AdminSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) {
      setDraft((current) => current ?? query.data);
    }
  }, [query.data]);

  const saved = query.data ?? null;
  const isDirty = Boolean(draft && saved && !flagsEqual(draft, saved));
  const saving = mutation.isPending;

  function toggle(key: FeatureFlagKey) {
    if (!draft || saving) {
      return;
    }
    setError(null);
    setDraft({ ...draft, [key]: !draft[key] });
  }

  async function save() {
    if (!draft || saving) {
      return;
    }
    if (!isDirty) {
      return;
    }
    setError(null);
    try {
      const next = await mutation.mutateAsync(draft);
      setDraft(next);
    } catch (caught) {
      setError(humanizeSettingsError(caught));
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.titleDesktop}>Настройки публичности</h1>
        <h1 className={styles.titleMobile}>Публичность</h1>
        <button
          type="button"
          className={`${styles.save} ${styles.saveTop}`}
          onClick={() => void save()}
          disabled={saving || query.isLoading}
        >
          Сохранить
        </button>
      </header>

      {query.isLoading && <p className={styles.state}>Загрузка…</p>}
      {query.isError && (
        <p className={styles.stateError} role="alert">
          Не удалось загрузить настройки. Обновите страницу.
        </p>
      )}
      {error && (
        <p className={styles.stateError} role="alert">
          {error}
        </p>
      )}

      {draft && (
        <div className={styles.list}>
          {FLAG_ROWS.map((row) => {
            const on = draft[row.key];
            return (
              <article key={row.key} className={styles.row}>
                <div className={styles.copy}>
                  <h2 className={styles.rowTitle}>{row.title}</h2>
                  <p className={styles.rowDescription}>{row.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={row.title}
                  className={`${styles.switch} ${on ? styles.switchOn : ''}`}
                  disabled={saving}
                  onClick={() => toggle(row.key)}
                >
                  <span className={styles.knob} />
                  <span className={styles.badgeLabel}>
                    {on ? 'Вкл.' : 'Выкл.'}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className={`${styles.save} ${styles.saveBottom}`}
        onClick={() => void save()}
        disabled={saving || query.isLoading}
      >
        Сохранить
      </button>
    </div>
  );
}
