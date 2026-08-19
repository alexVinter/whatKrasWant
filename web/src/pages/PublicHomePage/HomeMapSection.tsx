import { Link } from 'react-router-dom';
import { IdeasMap } from '../../shared/map/IdeasMap';
import { usePublicMapIdeas } from '../../features/public-ideas/queries';
import { useRevealOnScroll } from '../../shared/motion/useRevealOnScroll';
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
  const mapReveal = useRevealOnScroll<HTMLDivElement>({ threshold: 0.2 });

  return (
    <section id="map" className={styles.section} aria-labelledby="map-heading">
      <HomeSectionHeader
        title={
          <>
            <span className={styles.mapTitleMobile}>Инициативы на карте</span>
            <span className={styles.mapTitleDesktop}>Инициативы на карте города</span>
          </>
        }
        titleId="map-heading"
        className={styles.mapHeader}
        titleClassName={styles.mapTitle}
        trailing={<MapSubmitCta enabled={submissionEnabled} />}
      />

      <div className={styles.mapContainer}>
        <div
          ref={mapReveal.ref}
          className={`${styles.mapWrap} homeMotionRevealScale ${mapReveal.isVisible ? 'isVisible' : ''}`}
        >
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
