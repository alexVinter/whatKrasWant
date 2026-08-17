import { useAuditLog } from '../../../features/audit/queries';
import {
  auditActionLabel,
  formatAuditDateTime,
} from '../../../features/audit/labels';
import styles from './AdminAuditPage.module.css';

export function AdminAuditPage() {
  const audit = useAuditLog({ page: 1, pageSize: 100 });
  const items = audit.data?.items ?? [];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Журнал действий</h1>

      {audit.isLoading && <p className={styles.state}>Загрузка…</p>}
      {audit.isError && (
        <p className={styles.stateError} role="alert">
          Не удалось загрузить журнал. Обновите страницу.
        </p>
      )}
      {!audit.isLoading && !audit.isError && items.length === 0 && (
        <p className={styles.state}>Записей пока нет.</p>
      )}

      {items.length > 0 && (
        <div className={styles.list}>
          <div className={styles.listHeader} aria-hidden="true">
            <span>Дата и время</span>
            <span>Администратор</span>
            <span>Действие</span>
            <span>Объект</span>
          </div>

          {items.map((item) => (
            <article key={item.id} className={styles.row}>
              <span className={styles.date}>
                {formatAuditDateTime(item.createdAt)}
              </span>
              <span className={styles.admin}>
                {item.actor?.login ?? 'Администратор'}
              </span>
              <span className={styles.action}>
                {auditActionLabel(item.action)}
              </span>
              <span className={styles.meta}>
                {item.actor?.login ?? 'Администратор'} ·{' '}
                {formatAuditDateTime(item.createdAt)}
              </span>
              <span className={styles.object}>{item.objectLabel || '—'}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
