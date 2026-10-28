import styles from "./PanelHeader.module.css";

const ICON_URL = "/icon/48.png";

export function PanelHeader() {
  return (
    <>
      <div className={`${styles.sky} ${styles.planet}`} aria-hidden="true" />
      <div className={`${styles.sky} ${styles.ring}`} aria-hidden="true" />
      <div className={`${styles.sky} ${styles.sunDot}`} aria-hidden="true" />
      <div className={`${styles.sky} ${styles.tealDot}`} aria-hidden="true" />
      <header className={styles.header}>
        <p className={`${styles.brand} type-wordmark`}>
          <img className={styles.icon} src={ICON_URL} alt="" />
          Kiezpigeon
        </p>
        {/* Settings opens in Phase 2; the button is here so the header is complete. */}
        <button type="button" className={styles.settings} aria-label="Settings">
          <SettingsGlyph />
        </button>
      </header>
    </>
  );
}

function SettingsGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <rect className={styles.glyph} x="2" y="4" width="16" height="2.4" rx="1.2" />
      <rect className={styles.glyph} x="2" y="13.6" width="16" height="2.4" rx="1.2" />
      <circle className={styles.glyph} cx="7" cy="5.2" r="3" />
      <circle className={styles.glyph} cx="13" cy="14.8" r="3" />
    </svg>
  );
}
