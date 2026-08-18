import { useEffect, useRef, useState } from 'react';

interface UseRevealOnScrollOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

export function useRevealOnScroll<T extends HTMLElement = HTMLElement>(
  options: UseRevealOnScrollOptions = {},
) {
  const { threshold = 0.15, rootMargin = '0px 0px -8% 0px', once = true } = options;
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || isVisible) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible, once, rootMargin, threshold]);

  return { ref, isVisible };
}
