// The side panel: header, then onboarding until a profile is stored, then
// home. Settings and the tracker open from the header over either.
import { useState, type ReactNode } from "react";
import styles from "./App.module.css";
import { cx } from "./cx";
import { Card } from "./components/Card/Card";
import { PanelHeader } from "./components/PanelHeader/PanelHeader";
import { useStored } from "./hooks/useStored";
import { Home } from "./screens/Home/Home";
import { Onboarding } from "./screens/Onboarding/Onboarding";
import { Settings } from "./screens/Settings/Settings";
import { Tracker } from "./screens/Tracker/Tracker";

export function App() {
  const profile = useStored("profile");
  const [open, setOpen] = useState<"settings" | "tracker">();
  const close = (): void => {
    setOpen(undefined);
  };

  let over: ReactNode;
  if (profile.status === "loading") {
    over = null;
  } else if (open === "settings") {
    over = (
      <Settings
        profile={profile.status === "ready" ? profile.value : undefined}
        onClose={close}
      />
    );
  } else if (open === "tracker") {
    over = <Tracker onClose={close} />;
  }

  let screen: ReactNode;
  if (profile.status === "loading") {
    screen = null;
  } else if (profile.status === "invalid") {
    screen = <UnreadableProfile problems={profile.problems} />;
  } else if (profile.value) {
    screen = <Home profile={profile.value} />;
  } else {
    screen = <Onboarding />;
  }

  return (
    <main className={styles.panel}>
      <PanelHeader
        onTracker={() => {
          setOpen("tracker");
        }}
        onSettings={() => {
          setOpen("settings");
        }}
      />
      {over ?? screen}
    </main>
  );
}

function UnreadableProfile({ problems }: { problems: string[] }) {
  return (
    <Card title="Your profile could not be read">
      <p className={cx(styles.text, "type-body-sm")}>
        Open settings to import an export, or to start again with delete all
        data.
      </p>
      <ul className={cx(styles.text, "type-caption")}>
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </Card>
  );
}
