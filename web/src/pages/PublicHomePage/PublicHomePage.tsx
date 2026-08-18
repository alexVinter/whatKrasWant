import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePublicConfig } from '../../features/public-config/queries';
import { usePublicNews } from '../../features/news/queries';
import { formatNewsDate } from '../../features/news/form';
import {
  HorizontalSlider,
  HorizontalSliderItem,
  type HorizontalSliderHandle,
} from '../../shared/ui/HorizontalSlider/HorizontalSlider';
import { isDevPreview } from '../../shared/dev/isDevPreview';
import { heroComposition, MOCK_NEWS_CARDS } from './homeVisual.constants';
import { HomeMapSection } from './HomeMapSection';
import { HomeRatingSection } from './HomeRatingSection';
import { HomeSectionHeader } from './HomeSectionHeader';
import styles from './PublicHomePage.module.css';

export const PROJECT_COPY =
  'Общественная инициатива, которая собирает идеи горожан о развитии Красноярска: жители предлагают проекты и голосуют за лучшие, а самые популярные передаются администрации города.';

interface SubmitCtaProps {
  enabled: boolean;
  className?: string;
}

function SubmitCta({ enabled, className }: SubmitCtaProps) {
  if (enabled) {
    return (
      <Link to="/submit" className={className}>
        Предложить идею
      </Link>
    );
  }
  return (
    <button type="button" className={className} disabled aria-disabled="true">
      Предложить идею
    </button>
  );
}

export function PublicHomePage() {
  const configQuery = usePublicConfig();
  const newsQuery = usePublicNews();
  const newsSliderRef = useRef<HorizontalSliderHandle>(null);
  const features = configQuery.data?.features;
  const catalogEnabled = features?.PUBLIC_CATALOG ?? false;
  const submissionEnabled = features?.PUBLIC_SUBMISSION ?? false;
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
            <h1 id="hero-title" className={styles.heroTitle}>
              Чего хочет
              <br />
              Красноярск?
            </h1>
            <p className={styles.heroText}>
              <span className={styles.heroTextLine}>
                Общественная инициатива, которая собирает идеи горожан о развитии
              </span>
              <span className={styles.heroTextLine}>
                Красноярска: жители предлагают проекты и голосуют за лучшие, а
              </span>
              <span className={styles.heroTextLine}>
                самые популярные передаются администрации города.
              </span>
            </p>
            <SubmitCta enabled={submissionEnabled} className={styles.heroCta} />
            <p className={styles.ideasCount}>
              Количество собранных идей:{' '}
              <span className={styles.ideasCountValue}>—</span>
            </p>
          </div>
          <div className={styles.heroVisual}>
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

      <HomeMapSection
        catalogEnabled={catalogEnabled}
        submissionEnabled={submissionEnabled}
      />

      <HomeRatingSection catalogEnabled={catalogEnabled} />

      <section id="news" className={styles.newsSection} aria-labelledby="news-heading">
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
              <HorizontalSliderItem key={`mock-news-${index}`}>
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
            {liveNews.map((item) => (
              <HorizontalSliderItem key={item.slug}>
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
