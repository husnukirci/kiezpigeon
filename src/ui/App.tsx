import styles from "./App.module.css";
import { PanelHeader } from "./components/PanelHeader";

export function App() {
  return (
    <main className={styles.panel}>
      <PanelHeader />
      <p className={`${styles.intro} type-body`}>
        Open a flat listing on ImmoScout24 to get started.
      </p>
    </main>
  );
}
