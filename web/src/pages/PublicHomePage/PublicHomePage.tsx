import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePublicConfig } from '../../features/public-config/queries';
import { SubmitIdeaCta } from '../../features/public-submission/SubmitIdeaCta';
import { usePublicNews } from '../../features/news/queries';
import { formatNewsDate } from '../../features/news/form';
import {
  HorizontalSlider,
  HorizontalSliderItem,
  type HorizontalSliderHandle,
} from '../../shared/ui/HorizontalSlider/HorizontalSlider';
import { isDevPreview } from '../../shared/dev/isDevPreview';
import { useRevealOnScroll } from '../../shared/motion/useRevealOnScroll';
import { heroComposition, MOCK_NEWS_CARDS } from './homeVisual.constants';
import { HomeMapSection } from './HomeMapSection';
import { HomeRatingSection } from './HomeRatingSection';
import { HomeSectionHeader } from './HomeSectionHeader';
import styles from './PublicHomePage.module.css';

export const PROJECT_COPY =
  'Общественная инициатива, которая собирает идеи горожан о развитии Красноярска: жители предлагают проекты и голосуют за лучшие, а самые популярные передаются администрации города.';

export const PROJECT_COPY_MOBILE_LINES = [
  'Общественная инициатива, которая собирает идеи горожан о',
  'развитии Красноярска: жители предлагают проекты и',
  'голосуют за лучшие, а самые популярные передаются',
  'администрации города.',
] as const;

interface SubmitCtaProps {
  className?: string;
}

function SubmitCta({ className }: SubmitCtaProps) {
  return <SubmitIdeaCta className={className} />;
}

export function PublicHomePage() {
  const configQuery = usePublicConfig();
  const newsQuery = usePublicNews();
  const newsSliderRef = useRef<HorizontalSliderHandle>(null);
  const newsReveal = useRevealOnScroll<HTMLElement>();
  const features = configQuery.data?.features;
  const catalogEnabled = features?.PUBLIC_CATALOG ?? false;
  const liveNews = newsQuery.data?.items ?? [];
  const showLiveNews = newsQuery.isSuccess && liveNews.length > 0;
  const showMockNews = isDevPreview && !showLiveNews;
  const showNewsSlider = showLiveNews || showMockNews;

  const mockNewsCards = MOCK_NEWS_CARDS;

  return (
    <main className={styles.page}>
      <section id="project" className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1 id="hero-title" className={`${styles.heroTitle} homeMotionFadeUp`}>
              Чего хочет
              <br />
              Красноярск?
            </h1>
            <p className={`${styles.heroText} homeMotionFadeUpDelay1`}>
              <span className={styles.heroTextFull}>{PROJECT_COPY}</span>
              <span className={styles.heroTextMobile}>
                {PROJECT_COPY_MOBILE_LINES.map((line) => (
                  <span key={line} className={styles.heroTextLine}>
                    {line}
                  </span>
                ))}
              </span>
            </p>
            <SubmitCta className={`${styles.heroCta} homeMotionFadeUpDelay2`} />
            <p className={`${styles.ideasCount} homeMotionFadeUpDelay3`}>
              Количество собранных идей:{' '}
              <span className={styles.ideasCountValue}>
                {configQuery.isSuccess
                  ? configQuery.data.collectedIdeasCount
                  : '—'}
              </span>
            </p>
          </div>
          <div className={`${styles.heroVisual} homeMotionSlideIn`}>
            <div className={styles.heroArtViewport}>
              <img
                className={styles.heroImage}
                src={heroComposition}
                alt=""
                width={2222}
                height={1998}
              />
            </div>
          </div>
        </div>
        <div className={styles.heroBottomRule} aria-hidden="true" />
      </section>

      <HomeMapSection catalogEnabled={catalogEnabled} />

      <HomeRatingSection catalogEnabled={catalogEnabled} />

      <section
        id="news"
        ref={newsReveal.ref}
        className={`${styles.newsSection} ${newsReveal.isVisible ? 'homeMotionCardsVisible' : ''}`}
        aria-labelledby="news-heading"
      >
        <HomeSectionHeader
          title="Новости"
          titleId="news-heading"
          className={styles.newsHeader}
          titleClassName={styles.newsSectionTitle}
          viewAllHref="/news"
          showArrows={showNewsSlider}
          onPrev={() => newsSliderRef.current?.scrollPrev()}
          onNext={() => newsSliderRef.current?.scrollNext()}
        />

        {newsQuery.isLoading && !showLiveNews && !showMockNews && (
          <p className={styles.state}>Загрузка новостей…</p>
        )}
        {newsQuery.isError && !showLiveNews && !showMockNews && (
          <p className={styles.stateError} role="alert">
            Не удалось загрузить новости.
          </p>
        )}

        {showMockNews && (
          <HorizontalSlider ref={newsSliderRef} ariaLabel="Новости" className={styles.newsSlider}>
            {mockNewsCards.map((item, index) => (
              <HorizontalSliderItem
                key={`mock-news-${index}`}
                revealDelayMs={index * 100}
                className="homeMotionCardReveal"
              >
                <article className={styles.newsCard}>
                  <span className={styles.newsImageWrap}>
                    <img className={styles.newsImage} src={item.image} alt="" />
                  </span>
                  <span className={styles.newsDate}>{item.dateLabel}</span>
                  <span className={styles.newsCardTitle}>{item.title}</span>
                </article>
              </HorizontalSliderItem>
            ))}
          </HorizontalSlider>
        )}

        {showLiveNews && (
          <HorizontalSlider ref={newsSliderRef} ariaLabel="Новости" className={styles.newsSlider}>
            {liveNews.map((item, index) => (
              <HorizontalSliderItem
                key={item.slug}
                revealDelayMs={index * 100}
                className="homeMotionCardReveal"
              >
                <Link to={`/news/${item.slug}`} className={styles.newsCard}>
                  <span className={styles.newsImageWrap}>
                    {item.thumbnailUrl ? (
                      <img
                        className={styles.newsImage}
                        src={item.thumbnailUrl}
                        alt=""
                      />
                    ) : (
                      <span className={styles.newsImageFallback} />
                    )}
                  </span>
                  <span className={styles.newsDate}>
                    {formatNewsDate(item.publishDate)}
                  </span>
                  <span className={styles.newsCardTitle}>{item.title}</span>
                </Link>
              </HorizontalSliderItem>
            ))}
          </HorizontalSlider>
        )}
      </section>
    </main>
  );
}
