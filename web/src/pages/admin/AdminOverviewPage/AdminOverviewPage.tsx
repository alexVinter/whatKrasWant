import { Link, useNavigate } from 'react-router-dom';
import { useIdeasSummary } from '../../../features/ideas/queries';
import { useAuditLog } from '../../../features/audit/queries';
import {
  auditActionLabel,
  formatAuditDateTime,
} from '../../../features/audit/labels';
import type { IdeaSummary } from '../../../features/ideas/types';
import styles from './AdminOverviewPage.module.css';

const STAT_CARDS: { label: string; key: keyof IdeaSummary }[] = [
  { label: 'Всего инициатив', key: 'total' },
  { label: 'Черновики', key: 'draft' },
  { label: 'Опубликованные', key: 'published' },
  { label: 'Архив', key: 'archived' },
];

const QUICK_ACTIONS: { title: string; subtitle: string; to?: string }[] = [
  { title: 'Инициативы', subtitle: 'Открыть список и модерацию' },
  {
    title: 'Новости',
    subtitle: 'Добавление и редактирование',
    to: '/admin/news',
  },
  {
    title: 'Статистика и выгрузка',
    subtitle: 'Сводные данные для администратора',
    to: '/admin/statistics',
  },
  {
    title: 'Настройки',
    subtitle: 'Публичность, подача и голосование',
    to: '/admin/settings',
  },
];

export function AdminOverviewPage() {
  const navigate = useNavigate();
  const summary = useIdeasSummary();
  const recent = useAuditLog({ page: 1, pageSize: 3 });
  const recentItems = recent.data?.items ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Обзор</h1>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => navigate('/admin/initiatives/new')}
        >
          Добавить инициативу
        </button>
      </div>

      <section className={styles.stats} aria-label="Показатели">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className={styles.statCard}>
            {summary.isSuccess ? (
              <span className={styles.statNumber}>{summary.data[card.key]}</span>
            ) : (
              <span
                className={styles.statValue}
                role="img"
                aria-label={summary.isError ? 'Нет данных' : 'Загрузка'}
              />
            )}
            <span className={styles.statLabel}>{card.label}</span>
          </div>
        ))}
      </section>

      <div className={styles.panels}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Быстрые действия</h2>
          <div className={styles.actions}>
            {QUICK_ACTIONS.map((action) => {
              const content = (
                <>
                  <span className={styles.actionTitle}>{action.title}</span>
                  <span className={styles.actionSubtitle}>{action.subtitle}</span>
                </>
              );
              return action.to ? (
                <Link key={action.title} to={action.to} className={styles.actionCard}>
                  {content}
                </Link>
              ) : (
                <div key={action.title} className={styles.actionCard}>
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.recentPanel}`}>
          <h2 className={styles.panelTitle}>Последние действия</h2>
          {recent.isLoading && <p className={styles.empty}>Загрузка…</p>}
          {recent.isError && (
            <p className={styles.recentError} role="alert">
              Не удалось загрузить действия.
            </p>
          )}
          {!recent.isLoading && !recent.isError && recentItems.length === 0 && (
            <p className={styles.empty}>Записей пока нет.</p>
          )}
          {recentItems.length > 0 && (
            <ul className={styles.recentList}>
              {recentItems.map((item) => (
                <li key={item.id} className={styles.recentItem}>
                  <span className={styles.recentAction}>
                    {auditActionLabel(item.action)}
                  </span>
                  <span className={styles.recentMeta}>
                    {item.actor?.login ?? 'Администратор'} ·{' '}
                    {formatAuditDateTime(item.createdAt)}
                  </span>
                  <span className={styles.recentObject}>
                    {item.objectLabel || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
