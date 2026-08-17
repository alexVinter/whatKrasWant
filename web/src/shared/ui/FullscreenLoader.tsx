import styles from './FullscreenLoader.module.css';

export function FullscreenLoader() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.text}>Загрузка…</span>
    </div>
  );
}
