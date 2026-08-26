import { useState } from 'react';
import { downloadStatisticsXlsx } from '../../../features/statistics/api';
import {
  humanizeExportError,
  humanizeStatisticsError,
} from '../../../features/statistics/errors';
import { useAdminStatistics } from '../../../features/statistics/queries';
import type { NamedCount } from '../../../features/statistics/types';
import styles from './AdminStatisticsPage.module.css';

const KPI_CARDS: {
  key: 'expertInitiatives' | 'draft' | 'published' | 'archived';
  desktop: string;
  mobile: string;
}[] = [
  { key: 'expertInitiatives', desktop: 'Экспертные инициативы', mobile: 'Экспертные' },
  { key: 'draft', desktop: 'Черновики', mobile: 'Черновики' },
  { key: 'published', desktop: 'Опубликованные', mobile: 'Опубликовано' },
  { key: 'archived', desktop: 'Архив', mobile: 'Архив' },
];

function visibleBars(items: NamedCount[]): NamedCount[] {
  return items.filter((item) => item.count > 0);
}

function DistributionList({
  title,
  items,
  barClassName,
}: {
  title: string;
  items: NamedCount[];
  barClassName: string;
}) {
  const rows = visibleBars(items);
  const max = rows.reduce((acc, item) => Math.max(acc, item.count), 0);

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.empty}>Пока нет данных.</p>
      ) : (
        <ul className={styles.bars}>
          {rows.map((item) => (
            <li key={item.id} className={styles.barRow}>
              <span className={styles.barLabel}>{item.name}</span>
              <span className={styles.barTrack}>
                <span
                  className={barClassName}
                  style={{ width: `${Math.round((item.count / max) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminStatisticsPage() {
  const query = useAdminStatistics();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const data = query.data;

  async function exportXlsx() {
    if (exporting) {
      return;
    }
    setExportError(null);
    setExporting(true);
    try {
      await downloadStatisticsXlsx();
    } catch (error) {
      setExportError(humanizeExportError(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.titleDesktop}>Статистика и выгрузка</h1>
        <h1 className={styles.titleMobile}>Статистика</h1>
        <button
          type="button"
          className={`${styles.export} ${styles.exportTop}`}
          onClick={() => void exportXlsx()}
          disabled={exporting}
        >
          Сформировать XLSX
        </button>
      </header>

      {query.isError && (
        <p className={styles.stateError} role="alert">
          {humanizeStatisticsError(query.error)}
        </p>
      )}
      {exportError && (
        <p className={styles.stateError} role="alert">
          {exportError}
        </p>
      )}

      <section className={styles.kpis} aria-label="Показатели">
        {KPI_CARDS.map((card) => (
          <article key={card.key} className={styles.kpi}>
            {data ? (
              <span className={styles.kpiValue}>{data[card.key]}</span>
            ) : (
              <span
                className={styles.kpiDash}
                role="img"
                aria-label={query.isError ? 'Нет данных' : 'Загрузка'}
              />
            )}
            <span className={styles.kpiLabelDesktop}>{card.desktop}</span>
            <span className={styles.kpiLabelMobile}>{card.mobile}</span>
          </article>
        ))}
      </section>

      <div className={styles.distributions}>
        <DistributionList
          title="По территориям"
          items={data?.byTerritory ?? []}
          barClassName={styles.barFillTerritory}
        />
      </div>

      <section className={styles.xlsxInfo}>
        <h2 className={styles.xlsxTitle}>XLSX-выгрузка</h2>
        <p className={styles.xlsxText}>
          Инициативы, авторы и источники, голоса, статистика, топ-20. Служебные
          секреты в выгрузку не включаются.
        </p>
      </section>

      <button
        type="button"
        className={`${styles.export} ${styles.exportBottom}`}
        onClick={() => void exportXlsx()}
        disabled={exporting}
      >
        Сформировать XLSX
      </button>
    </div>
  );
}
