import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import { usePublicNewsDetail } from '../../../features/news/queries';
import { formatNewsDate } from '../../../features/news/form';
import styles from './PublicNewsDetailPage.module.css';

export function PublicNewsDetailPage() {
  const { slug = '' } = useParams();
  const query = usePublicNewsDetail(slug);
  const notFound =
    query.isError &&
    query.error instanceof ApiError &&
    query.error.status === 404;

  if (query.isLoading) {
    return <p className={styles.state}>Загрузка…</p>;
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <Link to="/news" className={styles.back}>
          Назад к новостям
        </Link>
        <h1 className={styles.title}>Новость не найдена</h1>
        <p className={styles.state}>
          Эта новость недоступна или снята с публикации.
        </p>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <p className={styles.stateError} role="alert">
        Не удалось загрузить новость. Обновите страницу.
      </p>
    );
  }

  const news = query.data;
  const paragraphs = news.body.split(/\n{2,}/);

  return (
    <article className={styles.page}>
      <Link to="/news" className={styles.back}>
        Назад к новостям
      </Link>
      <p className={styles.date}>{formatNewsDate(news.publishDate)}</p>
      <h1 className={styles.title}>{news.title}</h1>
      {news.image && (
        <div className={styles.imageFrame}>
          <img className={styles.image} src={news.image.url} alt="" />
        </div>
      )}
      <div className={styles.body}>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
