// Settings, from the header button: the profile's fields on one screen,
// saved on every change that leaves no field needing attention, then the
// data card. Before onboarding is done only the data card shows, so an
// export can be imported instead of typing everything again.
import { useCallback, useRef, useState } from "react";
import type { Profile } from "../../../rules/types";
import { write } from "../../../storage/storage";
import { cx } from "../../cx";
import { Button } from "../../components/Button/Button";
import { draftFrom, resolveDraft, type Draft } from "../profileForm/draft";
import {
  ApplicantsSection,
  DocumentsSection,
  HouseholdSection,
  LetterDefaultsSection,
} from "../profileForm/ProfileSections";
import screen from "../Screen.module.css";
import { ClaudeCard } from "./ClaudeCard";
import { DataCard } from "./DataCard";
import styles from "./Settings.module.css";

interface SettingsProps {
  profile: Profile | undefined;
  onClose: () => void;
}

type SaveState = "saved" | "unsaved" | "failed";

const SAVE_MESSAGE: Record<SaveState, string> = {
  saved: "Changes are saved as you type.",
  unsaved: "Not saved yet. Check the fields marked above.",
  failed: "Your changes could not be saved.",
};

// Saves each valid edit and tracks the message. The sequence counts edits,
// valid or not: a write's result only sets the message while no newer edit
// has happened (the guard useLetter and useContactForm use).
function useProfileSave(setDraft: (draft: Draft) => void) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const latest = useRef(0);

  const change = useCallback(
    (next: Draft): void => {
      setDraft(next);
      const edit = ++latest.current;
      const resolved = resolveDraft(next);
      if (Object.keys(resolved.errors).length > 0) {
        setSaveState("unsaved");
        return;
      }
      write("profile", resolved.profile).then(
        () => {
          if (edit === latest.current) setSaveState("saved");
        },
        () => {
          if (edit === latest.current) setSaveState("failed");
        },
      );
    },
    [setDraft],
  );

  return { saveState, change };
}

export function Settings({ profile, onClose }: SettingsProps) {
  const [draft, setDraft] = useState<Draft | undefined>(
    () => profile && draftFrom(profile),
  );
  const { saveState, change } = useProfileSave(setDraft);
  const errors = draft ? resolveDraft(draft).errors : {};

  const sections = draft && { draft, onChange: change, errors };

  return (
    <section className={screen.screen} aria-labelledby="settings-title">
      <div className={screen.heading}>
        <h1 id="settings-title" className={cx(screen.title, "type-title-lg")}>
          Settings
        </h1>
      </div>

      {sections && (
        <>
          <ApplicantsSection {...sections} />
          <HouseholdSection {...sections} />
          <DocumentsSection {...sections} />
          <LetterDefaultsSection {...sections} />
          <ClaudeCard />
        </>
      )}

      <DataCard profile={profile} onImported={onClose} onDeleted={onClose} />

      {sections && (
        <p
          className={cx(
            styles.saveState,
            saveState !== "saved" && styles.attention,
            "type-body-sm",
          )}
          aria-live="polite"
        >
          {SAVE_MESSAGE[saveState]}
        </p>
      )}

      <div className={screen.actions}>
        <Button kind="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </section>
  );
}
