import { useNavigate } from 'react-router-dom';
import { useAdminNews } from '../../../features/news/queries';
import { formatNewsDate } from '../../../features/news/form';
import type { NewsStatus } from '../../../features/news/types';
import styles from './AdminNewsPage.module.css';

const STATUS_LABEL: Record<NewsStatus, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликована',
};

export function AdminNewsPage() {
  const navigate = useNavigate();
  const query = useAdminNews();
  const items = query.data?.items ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Новости</h1>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => navigate('/admin/news/new')}
        >
          Добавить новость
        </button>
      </header>

      {query.isLoading && <p className={styles.state}>Загрузка…</p>}
      {query.isError && (
        <p className={styles.stateError} role="alert">
          Не удалось загрузить новости. Обновите страницу.
        </p>
      )}
      {query.isSuccess && items.length === 0 && (
        <p className={styles.state}>Пока нет новостей.</p>
      )}

      {items.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Заголовок</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={styles.row}
                    onClick={() => navigate(`/admin/news/${item.id}`)}
                  >
                    <td className={styles.titleCell}>{item.title}</td>
                    <td>{formatNewsDate(item.publishDate)}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          item.status === 'PUBLISHED'
                            ? styles.published
                            : styles.draft
                        }`}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.cards}>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={styles.card}
                  onClick={() => navigate(`/admin/news/${item.id}`)}
                >
                  <span className={styles.cardTitle}>{item.title}</span>
                  <span className={styles.cardMeta}>
                    <span>{formatNewsDate(item.publishDate)}</span>
                    <span
                      className={`${styles.badge} ${
                        item.status === 'PUBLISHED'
                          ? styles.published
                          : styles.draft
                      }`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
