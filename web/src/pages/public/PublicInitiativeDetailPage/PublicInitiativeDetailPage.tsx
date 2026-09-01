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

  const supportLabel = hasVoted ? 'Вы поддержали' : 'Поддержать';
  const supportDisabled = !votingEnabled || hasVoted || pending;

  return (
    <article className={styles.page}>
      <Link to="/initiatives" className={styles.back}>
        Назад
      </Link>

      <div className={styles.layout}>
        <div className={styles.mediaColumn}>
          {idea.image?.url ? (
            <img
              className={styles.heroImage}
              src={idea.image.url}
              alt={idea.title}
            />
          ) : (
            <div className={styles.heroFallback} aria-hidden="true" />
          )}

          {mapMarkers.length > 0 && (
            <div className={styles.inlineMapWrap}>
              <IdeasMap
                markers={mapMarkers}
                showPopups={false}
                height={220}
              />
            </div>
          )}
        </div>

        <div className={styles.contentColumn}>
          {idea.territory && (
            <p className={styles.territoryTag}>{idea.territory}</p>
          )}
          <p className={styles.author}>Автор: {idea.authorName}</p>
          <h1 className={styles.title}>{idea.title}</h1>

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

          <div className={styles.description}>{idea.description}</div>

          {idea.territory && (
            <section className={styles.locationBlock} aria-label="Место на карте">
              <h2 className={styles.locationTitle}>Место на карте</h2>
              <p className={styles.locationText}>{idea.territory}</p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
