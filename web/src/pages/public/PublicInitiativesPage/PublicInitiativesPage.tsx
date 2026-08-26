import { Link } from 'react-router-dom';
import { usePublicConfig } from '../../../features/public-config/queries';
import { usePublicIdeas } from '../../../features/public-ideas/queries';
import type { PublicIdeaListItem } from '../../../features/public-ideas/types';
import styles from './PublicInitiativesPage.module.css';

export function PublicInitiativesPage() {
  const configQuery = usePublicConfig();
  const catalogEnabled = configQuery.data?.features.PUBLIC_CATALOG ?? false;
  const ideasQuery = usePublicIdeas(catalogEnabled);
  const items = ideasQuery.data?.items ?? [];

  if (configQuery.isLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.state}>Загрузка…</p>
      </div>
    );
  }

  if (!catalogEnabled) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Все инициативы</h1>
        <p className={styles.closed} role="status">
          Каталог инициатив временно недоступен.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Все инициативы</h1>

      {ideasQuery.isLoading && <p className={styles.state}>Загрузка…</p>}
      {ideasQuery.isError && (
        <p className={styles.stateError} role="alert">
          Не удалось загрузить инициативы.
        </p>
      )}
      {ideasQuery.isSuccess && items.length === 0 && (
        <p className={styles.state}>Пока нет опубликованных инициатив.</p>
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item: PublicIdeaListItem, index: number) => (
            <li key={item.slug}>
              <Link to={`/initiatives/${item.slug}`} className={styles.card}>
                <span className={styles.rank} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.thumbWrap}>
                  {item.thumbnailUrl ? (
                    <img
                      className={styles.thumb}
                      src={item.thumbnailUrl}
                      alt=""
                    />
                  ) : (
                    <span className={styles.thumbFallback} />
                  )}
                </span>
                <span className={styles.body}>
                  <span className={styles.author}>Автор: {item.authorName}</span>
                  <span className={styles.cardTitle}>{item.title}</span>
                  {item.description ? (
                    <span className={styles.description}>{item.description}</span>
                  ) : null}
                  {item.territory && (
                    <span className={styles.territory}>{item.territory}</span>
                  )}
                </span>
                <span className={styles.votes}>Голосов: {item.voteCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
