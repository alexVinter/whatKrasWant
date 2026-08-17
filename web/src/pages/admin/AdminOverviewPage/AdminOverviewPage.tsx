import styles from './AdminOverviewPage.module.css';

// Statistics backend does not exist yet: values are shown as a neutral
// placeholder ("—" bar), never as fabricated numbers.
const STAT_CARDS = [
  { label: 'Всего инициатив' },
  { label: 'Черновики' },
  { label: 'Опубликованные' },
  { label: 'Архив' },
];

// Navigation shortcuts from the approved layout. Target sections are not
// implemented in E04, so these cards are non-interactive placeholders.
const QUICK_ACTIONS = [
  { title: 'Инициативы', subtitle: 'Открыть список и модерацию' },
  { title: 'Новости', subtitle: 'Добавление и редактирование' },
  { title: 'Статистика и выгрузка', subtitle: 'Сводные данные для администратора' },
  { title: 'Настройки', subtitle: 'Публичность, подача и голосование' },
];

export function AdminOverviewPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Обзор</h1>
        <button type="button" className={styles.addButton}>
          Добавить инициативу
        </button>
      </div>

      <section className={styles.stats} aria-label="Показатели">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className={styles.statCard}>
            <span
              className={styles.statValue}
              role="img"
              aria-label="Нет данных"
            />
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
