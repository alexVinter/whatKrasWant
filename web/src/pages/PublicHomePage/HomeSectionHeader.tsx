import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './HomeSectionHeader.module.css';

interface HomeSectionHeaderProps {
  title: ReactNode;
  titleId: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  onPrev?: () => void;
  onNext?: () => void;
  showArrows?: boolean;
  trailing?: ReactNode;
  className?: string;
  titleClassName?: string;
}

function ChevronLeftIcon() {
  return (
    <svg className={styles.arrowIcon} viewBox="7 5 10 14" aria-hidden="true">
      <path
        d="M15 6 9 12l6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className={styles.arrowIcon} viewBox="7 5 10 14" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeSectionHeader({
  title,
  titleId,
  viewAllHref,
  viewAllLabel = 'Смотреть все',
  onPrev,
  onNext,
  showArrows = false,
  trailing,
  className,
  titleClassName,
}: HomeSectionHeaderProps) {
  return (
    <div className={`${styles.header} ${className ?? ''}`.trim()}>
      <h2 id={titleId} className={`${styles.title} ${titleClassName ?? ''}`.trim()}>
        {title}
      </h2>
      <div className={styles.actions}>
        {showArrows && (
          <div className={styles.arrows}>
            <button
              type="button"
              className={styles.arrow}
              aria-label="Предыдущий"
              onClick={onPrev}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className={styles.arrow}
              aria-label="Следующий"
              onClick={onNext}
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
        {viewAllHref && (
          <Link to={viewAllHref} className={styles.viewAll}>
            {viewAllLabel}
          </Link>
        )}
        {trailing}
      </div>
    </div>
  );
}
