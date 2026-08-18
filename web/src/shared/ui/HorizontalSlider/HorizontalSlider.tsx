import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import styles from './HorizontalSlider.module.css';

export interface HorizontalSliderHandle {
  scrollPrev: () => void;
  scrollNext: () => void;
}

interface HorizontalSliderProps {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}

export const HorizontalSlider = forwardRef<
  HorizontalSliderHandle,
  HorizontalSliderProps
>(function HorizontalSlider({ children, ariaLabel, className }, ref) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const card = track.querySelector<HTMLElement>(`.${styles.item}`);
    const gapValue = getComputedStyle(track).columnGap || getComputedStyle(track).gap;
    const gap = Number.parseFloat(gapValue) || 20;
    const delta = card ? card.offsetWidth + gap : track.clientWidth * 0.85;
    track.scrollBy({ left: direction * delta, behavior: 'smooth' });
  };

  useImperativeHandle(ref, () => ({
    scrollPrev: () => scrollBy(-1),
    scrollNext: () => scrollBy(1),
  }));

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <div
        ref={trackRef}
        className={styles.track}
        aria-label={ariaLabel}
        role="list"
      >
        {children}
      </div>
    </div>
  );
});

export function HorizontalSliderItem({
  children,
  className,
  revealDelayMs,
}: {
  children: ReactNode;
  className?: string;
  revealDelayMs?: number;
}) {
  const style =
    revealDelayMs !== undefined
      ? ({ '--home-card-reveal-delay': `${revealDelayMs}ms` } as CSSProperties)
      : undefined;

  return (
    <div
      className={`${styles.item} ${className ?? ''}`.trim()}
      role="listitem"
      style={style}
    >
      {children}
    </div>
  );
}
