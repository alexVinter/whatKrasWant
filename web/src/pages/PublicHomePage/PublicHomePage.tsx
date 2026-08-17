import styles from './PublicHomePage.module.css';

export function PublicHomePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Чего хочет Красноярск?</h1>
      <p className={styles.note}>Публичная часть находится в разработке.</p>
    </main>
  );
}
