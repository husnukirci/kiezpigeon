// "A closer look": the deeper read of the listing, on the user's click
// only. Sections are keyed by position because two can share a heading.
// Status is never colour alone: the reading line and the error are words.
import type { AnalysisState } from "../../hooks/useAnalysis";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { cx } from "../../cx";
import styles from "./ListingAnalysis.module.css";

interface ListingAnalysisProps {
  state: AnalysisState;
  onAnalyse: () => void;
}

export function ListingAnalysis({ state, onAnalyse }: ListingAnalysisProps) {
  return (
    <Card title="A closer look">
      {state.status === "idle" && (
        <p className={cx(styles.text, "type-body-sm")}>
          A deeper read of this listing: the area, the price, heating and how it
          fits you. About 5 cents on your key.
        </p>
      )}
      {state.status === "reading" && (
        <p role="status" className={cx(styles.text, "type-body-sm")}>
          Reading the listing
        </p>
      )}
      {state.status === "failed" && (
        <p role="alert" className={cx(styles.text, "type-body-sm")}>
          {state.message}
        </p>
      )}
      {state.status === "ready" && (
        <>
          {state.sections.map((section, index) => (
            <div key={index} className={styles.section}>
              <h3 className={cx(styles.heading, "type-label")}>
                {section.heading}
              </h3>
              {section.text.split(/\n\s*\n/).map((paragraph, i) => (
                <p key={i} className={cx(styles.text, "type-body-sm")}>
                  {paragraph.trim()}
                </p>
              ))}
            </div>
          ))}
          <p className={cx(styles.caption, "type-caption")}>
            An estimate from the page and what is known about the area. Check
            anything that matters before you rely on it.
          </p>
        </>
      )}
      {state.status !== "ready" && (
        <Button disabled={state.status === "reading"} onClick={onAnalyse}>
          {state.status === "failed" ? "Try again" : "Analyse this listing"}
        </Button>
      )}
    </Card>
  );
}
