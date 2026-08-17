import { STATUS_LABELS } from '../../../features/ideas/labels';
import type { IdeaStatus } from '../../../features/ideas/types';
import styles from './StatusBadge.module.css';

const STATUS_CLASS: Record<IdeaStatus, string> = {
  DRAFT: styles.draft,
  MODERATION: styles.moderation,
  PUBLISHED: styles.published,
  ARCHIVED: styles.archived,
};

export function StatusBadge({ status }: { status: IdeaStatus }) {
  return (
    <span className={`${styles.badge} ${STATUS_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
