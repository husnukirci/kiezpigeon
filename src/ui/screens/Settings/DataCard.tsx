// "Your data": export to a JSON file, import one back (every problem named,
// nothing stored until the user confirms), and delete all data.
import { useState, type ChangeEvent } from "react";
import { exportData, importData } from "../../../rules/profile";
import type { Application, Profile } from "../../../rules/types";
import { clearAll, writeAll } from "../../../storage/storage";
import { cx } from "../../cx";
import { Button, buttonClassName } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { useStored } from "../../hooks/useStored";
import styles from "./DataCard.module.css";

interface DataCardProps {
  profile: Profile | undefined;
  /** After an import was stored. */
  onImported: () => void;
  /** After everything was deleted. */
  onDeleted: () => void;
}

type Flow =
  | { step: "idle" }
  | { step: "problems"; problems: string[] }
  | {
      step: "confirmImport";
      profile: Profile;
      applications: Application[];
    }
  | { step: "confirmDelete" }
  | { step: "failed"; message: string };

function applicationsLabel(count: number): string {
  return count === 1 ? "1 application" : `${count} applications`;
}

export function DataCard({ profile, onImported, onDeleted }: DataCardProps) {
  const applications = useStored("applications");
  const [flow, setFlow] = useState<Flow>({ step: "idle" });

  const onExport = (): void => {
    if (!profile) return;
    if (applications.status !== "ready") {
      setFlow({
        step: "failed",
        message:
          "Your applications could not be read, so nothing was exported.",
      });
      return;
    }
    const now = new Date();
    const file = exportData(
      profile,
      applications.value ?? [],
      now.toISOString(),
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `kiezpigeon-${now.toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Reset so choosing the same file again still fires a change.
    input.value = "";
    if (!file) return;
    const result = importData(await file.text());
    setFlow(
      result.ok
        ? { step: "confirmImport", ...result.value }
        : { step: "problems", problems: result.problems },
    );
  };

  const confirmImport = (data: {
    profile: Profile;
    applications: Application[];
  }): void => {
    writeAll(data).then(onImported, (error: unknown) => {
      setFlow({
        step: "failed",
        message: `The import could not be stored: ${String(error)}`,
      });
    });
  };

  const confirmDelete = (): void => {
    clearAll().then(onDeleted, (error: unknown) => {
      setFlow({
        step: "failed",
        message: `Your data could not be deleted: ${String(error)}`,
      });
    });
  };

  const cancel = (): void => {
    setFlow({ step: "idle" });
  };

  return (
    <Card title="Your data">
      <p className={cx(styles.text, "type-body-sm")}>
        Everything stays in this browser. Export a copy to move it or keep it
        safe.
      </p>
      <div className={styles.row}>
        <Button disabled={!profile} onClick={onExport}>
          Export
        </Button>
        <label className={cx(buttonClassName("secondary"), styles.import)}>
          Import
          <input
            className={styles.fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              void onFile(e);
            }}
          />
        </label>
      </div>
      <Button
        onClick={() => {
          setFlow({ step: "confirmDelete" });
        }}
      >
        Delete all data
      </Button>

      <div aria-live="polite" className={styles.flow}>
        {flow.step === "problems" && (
          <div className={styles.message}>
            <p className={cx(styles.warn, "type-body-sm")}>
              This file can&apos;t be imported. Nothing was changed.
            </p>
            <ul className={cx(styles.problems, "type-caption")}>
              {flow.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        {flow.step === "confirmImport" && (
          <div className={styles.message}>
            <p className={cx(styles.text, "type-body-sm")}>
              This file has a profile and{" "}
              {applicationsLabel(flow.applications.length)}. Importing replaces
              what is stored now.
            </p>
            <div className={styles.row}>
              <Button
                onClick={() => {
                  confirmImport({
                    profile: flow.profile,
                    applications: flow.applications,
                  });
                }}
              >
                Replace my data
              </Button>
              <Button onClick={cancel}>Cancel</Button>
            </div>
          </div>
        )}
        {flow.step === "confirmDelete" && (
          <div className={styles.message}>
            <p className={cx(styles.text, "type-body-sm")}>
              This deletes your profile, your applications and your settings
              from this browser. It can&apos;t be undone.
            </p>
            <div className={styles.row}>
              <Button onClick={confirmDelete}>Delete everything</Button>
              <Button onClick={cancel}>Cancel</Button>
            </div>
          </div>
        )}
        {flow.step === "failed" && (
          <p className={cx(styles.warn, "type-body-sm")} role="alert">
            {flow.message}
          </p>
        )}
      </div>
    </Card>
  );
}
