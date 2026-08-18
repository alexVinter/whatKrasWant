import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePublicIdeas } from '../../features/public-ideas/queries';
import {
  HorizontalSlider,
  HorizontalSliderItem,
  type HorizontalSliderHandle,
} from '../../shared/ui/HorizontalSlider/HorizontalSlider';
import { isDevPreview } from '../../shared/dev/isDevPreview';
import { useRevealOnScroll } from '../../shared/motion/useRevealOnScroll';
import { MOCK_RATING_CARDS } from './homeVisual.constants';
import { HomeSectionHeader } from './HomeSectionHeader';
import styles from './HomeRatingSection.module.css';

function formatVotes(count: number): string {
  return `Голосов: ${count}`;
}

interface HomeRatingSectionProps {
  catalogEnabled: boolean;
}

export function HomeRatingSection({ catalogEnabled }: HomeRatingSectionProps) {
  const sliderRef = useRef<HorizontalSliderHandle>(null);
  const query = usePublicIdeas(catalogEnabled);
  const liveItems = useMemo(() => {
    const list = query.data?.items ?? [];
    return [...list].sort((a, b) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      return a.title.localeCompare(b.title, 'ru');
    });
  }, [query.data?.items]);

  const showLiveRating = catalogEnabled && query.isSuccess && liveItems.length > 0;
  const showMockRating = isDevPreview && !showLiveRating;
  const showArrows = showLiveRating || showMockRating;
  const sectionReveal = useRevealOnScroll<HTMLElement>({ threshold: 0.12 });

  return (
    <section
      id="rating"
      ref={sectionReveal.ref}
      className={`${styles.section} ${sectionReveal.isVisible ? 'homeMotionCardsVisible' : ''}`}
      aria-labelledby="rating-heading"
    >
      <HomeSectionHeader
        title="Рейтинг инициатив"
        titleId="rating-heading"
        className={styles.ratingHeader}
        titleClassName={styles.ratingTitle}
        viewAllHref="/initiatives"
        showArrows={showArrows}
        onPrev={() => sliderRef.current?.scrollPrev()}
        onNext={() => sliderRef.current?.scrollNext()}
      />

      {catalogEnabled && query.isLoading && !showLiveRating && !showMockRating && (
        <p className={styles.state}>Загрузка рейтинга…</p>
      )}
      {catalogEnabled && query.isError && (
        <p className={styles.stateError} role="alert">
          Не удалось загрузить рейтинг инициатив.
        </p>
      )}

      {showMockRating && (
        <HorizontalSlider
          ref={sliderRef}
          ariaLabel="Рейтинг инициатив"
          className={styles.ratingSlider}
        >
          {MOCK_RATING_CARDS.map((item, index) => (
            <HorizontalSliderItem
              key={item.rank}
              revealDelayMs={index * 100}
              className="homeMotionCardReveal"
            >
              <article className={styles.card} aria-label={item.title}>
                <span className={styles.imageWrap}>
                  <span className={styles.rank} aria-hidden="true">
                    {item.rank}
                  </span>
                  <img className={styles.image} src={item.previewImage} alt="" />
                </span>
                <span className={styles.author}>Автор: {item.authorName}</span>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.votes}>{formatVotes(item.voteCount)}</span>
              </article>
            </HorizontalSliderItem>
          ))}
        </HorizontalSlider>
      )}

      {showLiveRating && (
        <HorizontalSlider
          ref={sliderRef}
          ariaLabel="Рейтинг инициатив"
          className={styles.ratingSlider}
        >
          {liveItems.map((item, index) => (
            <HorizontalSliderItem
              key={item.slug}
              revealDelayMs={index * 100}
              className="homeMotionCardReveal"
            >
              <Link to={`/initiatives/${item.slug}`} className={styles.card}>
                <span className={styles.imageWrap}>
                  <span className={styles.rank} aria-hidden="true">
                    {index + 1}
                  </span>
                  {item.thumbnailUrl ? (
                    <img className={styles.image} src={item.thumbnailUrl} alt="" />
                  ) : (
                    <span className={styles.imageFallback} />
                  )}
                </span>
                <span className={styles.author}>Автор: {item.authorName}</span>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.votes}>{formatVotes(item.voteCount)}</span>
              </Link>
            </HorizontalSliderItem>
          ))}
        </HorizontalSlider>
      )}
    </section>
  );
}
