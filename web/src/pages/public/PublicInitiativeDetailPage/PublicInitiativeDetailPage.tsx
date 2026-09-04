import { Link, useParams } from 'react-router-dom';
import { usePublicConfig } from '../../../features/public-config/queries';
import { usePublicIdeaDetail } from '../../../features/public-ideas/queries';
import { useVoteIdea } from '../../../features/public-vote/useVoteIdea';
import { IdeasMap } from '../../../shared/map/IdeasMap';
import styles from './PublicInitiativeDetailPage.module.css';

export function PublicInitiativeDetailPage() {
  const { slug = '' } = useParams();
  const configQuery = usePublicConfig();
  const catalogEnabled = configQuery.data?.features.PUBLIC_CATALOG ?? false;
  const detailQuery = usePublicIdeaDetail(slug, catalogEnabled);
  const idea = detailQuery.data;
  const { support, votingEnabled, pending, localHasVoted } = useVoteIdea(slug);
  const hasVoted = Boolean(idea?.hasVoted || localHasVoted);

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
        <Link to="/" className={styles.back}>
          Назад
        </Link>
        <p className={styles.closed} role="status">
          Каталог инициатив временно недоступен.
        </p>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className={styles.page}>
        <Link to="/initiatives" className={styles.back}>
          Назад
        </Link>
        <p className={styles.state}>Загрузка…</p>
      </div>
    );
  }

  if (detailQuery.isError || !idea) {
    return (
      <div className={styles.page}>
        <Link to="/initiatives" className={styles.back}>
          Назад
        </Link>
        <p className={styles.closed} role="status">
          Инициатива не найдена.
        </p>
      </div>
    );
  }

  const mapMarkers =
    idea.latitude !== null && idea.longitude !== null
      ? [
          {
            slug: idea.slug,
            title: idea.title,
            authorName: idea.authorName,
            latitude: idea.latitude,
            longitude: idea.longitude,
            thumbnailUrl: idea.image?.url ?? null,
          },
        ]
      : [];

  const hasMap = mapMarkers.length > 0;
  const hasImage = Boolean(idea.image?.url);
  const showMediaRow = hasImage || hasMap;

  const supportLabel = hasVoted ? 'Вы поддержали' : 'Поддержать';
  const supportDisabled = !votingEnabled || hasVoted || pending;

  const mediaRowClassName = [
    styles.mediaRow,
    hasImage && hasMap ? styles.mediaRowSplit : styles.mediaRowSingle,
  ].join(' ');

  return (
    <article className={styles.page}>
      <Link to="/initiatives" className={styles.back}>
        Назад
      </Link>

      <div className={styles.stack}>
        {showMediaRow && (
          <div className={mediaRowClassName}>
            {hasImage && idea.image && (
              <div className={styles.imageFrame}>
                <img
                  className={styles.heroImage}
                  src={idea.image.url}
                  alt={idea.title}
                />
              </div>
            )}

            {hasMap && (
              <div className={styles.mapCard}>
                <IdeasMap
                  markers={mapMarkers}
                  showPopups={false}
                  height="100%"
                />
              </div>
            )}
          </div>
        )}

        <div className={styles.infoSection}>
          {(idea.territory || idea.address) && (
            <div className={styles.location}>
              {idea.territory && (
                <p className={styles.territoryTag}>{idea.territory}</p>
              )}
              {idea.address && (
                <p className={styles.address}>{idea.address}</p>
              )}
            </div>
          )}

          <p className={styles.author}>Автор: {idea.authorName}</p>
          <h1 className={styles.title}>{idea.title}</h1>

          <div className={styles.description}>{idea.description}</div>

          <div className={styles.actions}>
            <p className={styles.votes}>Голосов: {idea.voteCount}</p>
            <button
              type="button"
              className={styles.support}
              disabled={supportDisabled}
              aria-disabled={supportDisabled}
              onClick={() => {
                void support();
              }}
            >
              {pending ? 'Поддержка…' : supportLabel}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
