import { IdeasMap } from '../../shared/map/IdeasMap';
import { SubmitIdeaCta } from '../../features/public-submission/SubmitIdeaCta';
import { usePublicMapIdeas } from '../../features/public-ideas/queries';
import { useRevealOnScroll } from '../../shared/motion/useRevealOnScroll';
import { HomeSectionHeader } from './HomeSectionHeader';
import styles from './HomeMapSection.module.css';

interface HomeMapSectionProps {
  catalogEnabled: boolean;
}

export function HomeMapSection({ catalogEnabled }: HomeMapSectionProps) {
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
        trailing={<SubmitIdeaCta className={styles.mapCta} />}
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
