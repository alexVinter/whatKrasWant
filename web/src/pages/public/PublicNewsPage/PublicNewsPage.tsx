import { Link } from 'react-router-dom';
import { usePublicNews } from '../../../features/news/queries';
import { formatNewsDate } from '../../../features/news/form';
import styles from './PublicNewsPage.module.css';

export function PublicNewsPage() {
  const query = usePublicNews();
  const items = query.data?.items ?? [];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Новости</h1>

      {query.isLoading && <p className={styles.state}>Загрузка…</p>}
      {query.isError && (
        <p className={styles.stateError} role="alert">
          Не удалось загрузить новости. Обновите страницу.
        </p>
      )}
      {query.isSuccess && items.length === 0 && (
        <p className={styles.state}>Пока нет опубликованных новостей.</p>
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.slug}>
              <Link to={`/news/${item.slug}`} className={styles.card}>
                <span className={styles.imageWrap}>
                  {item.thumbnailUrl ? (
                    <img
                      className={styles.image}
                      src={item.thumbnailUrl}
                      alt=""
                    />
                  ) : (
                    <span className={styles.imageFallback} />
                  )}
                </span>
                <span className={styles.date}>
                  {formatNewsDate(item.publishDate)}
                </span>
                <span className={styles.cardTitle}>{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
