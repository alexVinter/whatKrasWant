import logoHorizontalRed from '../brand/k400-logo-horizontal-red.svg';
import styles from './BrandLogo.module.css';

type BrandLogoVariant = 'login' | 'sidebar' | 'topbar';

/**
 * Official K400 protocol block. Do not reconstruct this mark with text or CSS.
 * Light surfaces use the official red horizontal SVG.
 */
export function BrandLogo({ variant = 'login' }: { variant?: BrandLogoVariant }) {
  return (
    <img
      className={`${styles.logo} ${styles[variant]}`}
      src={logoHorizontalRed}
      alt="400 лет Красноярску"
    />
  );
}
