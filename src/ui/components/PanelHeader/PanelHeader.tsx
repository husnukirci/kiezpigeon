// PanelHeader (design system components/PanelHeader/README.md): icon and
// wordmark, then the icon buttons. The README has Settings only; "Your
// pigeons" sits beside it so the tracker opens from every screen.
import { cx } from "../../cx";
import styles from "./PanelHeader.module.css";

const ICON_URL = "/icon/48.png";

interface PanelHeaderProps {
  onTracker: () => void;
  onSettings: () => void;
}

export function PanelHeader({ onTracker, onSettings }: PanelHeaderProps) {
  return (
    <>
      <div className={cx(styles.sky, styles.planet)} aria-hidden="true" />
      <div className={cx(styles.sky, styles.ring)} aria-hidden="true" />
      <div className={cx(styles.sky, styles.sunDot)} aria-hidden="true" />
      <div className={cx(styles.sky, styles.tealDot)} aria-hidden="true" />
      <header className={styles.header}>
        <p className={cx(styles.brand, "type-wordmark")}>
          <img className={styles.icon} src={ICON_URL} alt="" />
          Kiezpigeon
        </p>
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Your pigeons"
            onClick={onTracker}
          >
            <PigeonsGlyph />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Settings"
            onClick={onSettings}
          >
            <SettingsGlyph />
          </button>
        </div>
      </header>
    </>
  );
}

function SettingsGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <rect
        className={styles.glyph}
        x="2"
        y="4"
        width="16"
        height="2.4"
        rx="1.2"
      />
      <rect
        className={styles.glyph}
        x="2"
        y="13.6"
        width="16"
        height="2.4"
        rx="1.2"
      />
      <circle className={styles.glyph} cx="7" cy="5.2" r="3" />
      <circle className={styles.glyph} cx="13" cy="14.8" r="3" />
    </svg>
  );
}

/** A list: three rows, each a dot and a rounded bar. */
function PigeonsGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      {[3, 8.8, 14.6].map((y) => (
        <g key={y}>
          <circle className={styles.glyph} cx="3.2" cy={y + 1.2} r="1.8" />
          <rect
            className={styles.glyph}
            x="7"
            y={y}
            width="11"
            height="2.4"
            rx="1.2"
          />
        </g>
      ))}
    </svg>
  );
}
