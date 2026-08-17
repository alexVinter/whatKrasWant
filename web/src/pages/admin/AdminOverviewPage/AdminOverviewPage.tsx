import { useNavigate } from 'react-router-dom';
import { useIdeasSummary } from '../../../features/ideas/queries';
import type { IdeaSummary } from '../../../features/ideas/types';
import styles from './AdminOverviewPage.module.css';

const STAT_CARDS: { label: string; key: keyof IdeaSummary }[] = [
  { label: 'Всего инициатив', key: 'total' },
  { label: 'Черновики', key: 'draft' },
  { label: 'Опубликованные', key: 'published' },
  { label: 'Архив', key: 'archived' },
];

// Navigation shortcuts from the approved layout. Only "Инициативы" is wired in
// E06; the remaining sections are placeholders until their stages.
const QUICK_ACTIONS = [
  { title: 'Инициативы', subtitle: 'Открыть список и модерацию' },
  { title: 'Новости', subtitle: 'Добавление и редактирование' },
  { title: 'Статистика и выгрузка', subtitle: 'Сводные данные для администратора' },
  { title: 'Настройки', subtitle: 'Публичность, подача и голосование' },
];

export function AdminOverviewPage() {
  const navigate = useNavigate();
  const summary = useIdeasSummary();

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
            {QUICK_ACTIONS.map((action) => (
              <div key={action.title} className={styles.actionCard}>
                <span className={styles.actionTitle}>{action.title}</span>
                <span className={styles.actionSubtitle}>{action.subtitle}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.recentPanel}`}>
          <h2 className={styles.panelTitle}>Последние действия</h2>
          <p className={styles.empty} aria-hidden="true">
            —
          </p>
        </section>
      </div>
    </div>
  );
}
