import { useEffect, useState } from 'react';

const HOME_SECTION_IDS = ['project', 'map', 'rating', 'news'] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export function useActiveHomeSection(enabled: boolean) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>('project');

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const sections = HOME_SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (section): section is HTMLElement => section !== null,
    );

    if (sections.length === 0) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target?.id;
          if (!id) {
            continue;
          }
          ratios.set(id, entry.intersectionRatio);
        }

        let bestId: HomeSectionId = 'project';
        let bestRatio = 0;

        for (const id of HOME_SECTION_IDS) {
          const ratio = ratios.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        if (bestRatio > 0) {
          setActiveSection(bestId);
        }
      },
      {
        rootMargin: '-35% 0px -45% 0px',
        threshold: [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
      },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [enabled]);

  return activeSection;
}
