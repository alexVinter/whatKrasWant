import { Link } from 'react-router-dom';
import { IdeasMap } from '../../shared/map/IdeasMap';
import { usePublicMapIdeas } from '../../features/public-ideas/queries';
import { HomeSectionHeader } from './HomeSectionHeader';
import styles from './HomeMapSection.module.css';

interface HomeMapSectionProps {
  catalogEnabled: boolean;
  submissionEnabled: boolean;
}

function MapSubmitCta({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <Link to="/submit" className={styles.mapCta}>
        Предложить идею
      </Link>
    );
  }
  return (
    <button type="button" className={styles.mapCta} disabled aria-disabled="true">
      Предложить идею
    </button>
  );
}

export function HomeMapSection({
  catalogEnabled,
  submissionEnabled,
}: HomeMapSectionProps) {
  const query = usePublicMapIdeas(catalogEnabled);
  const markers = query.data?.items ?? [];

  return (
    <section id="map" className={styles.section} aria-labelledby="map-heading">
      <HomeSectionHeader
        title="Инициативы на карте города"
        titleId="map-heading"
        className={styles.mapHeader}
        titleClassName={styles.mapTitle}
        trailing={<MapSubmitCta enabled={submissionEnabled} />}
      />

      <div className={styles.mapContainer}>
        <div className={styles.mapWrap}>
          <IdeasMap markers={markers} className={styles.map} />
          {catalogEnabled && query.isLoading && (
            <p className={styles.stateOverlay} role="status">
              Загрузка маркеров…
            </p>
          )}
          {catalogEnabled && query.isError && (
            <p className={styles.stateOverlay} role="alert">
              Маркеры временно недоступны.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
