// "About this listing" (design system screen 2, Phase 13): what the page
// says about the kind of rental, where its price sits against the band the
// page prints, and what is worth a second look. It informs; the user
// decides. Status is never colour alone: a note carries the exclamation,
// nothing found the tick, and the plain lines their label word.
import { analyseListing } from "../../../rules/analysis";
import type { AnalysisLine, Listing } from "../../../rules/types";
import { Card } from "../../components/Card/Card";
import { ExclamationIcon, TickIcon } from "../../components/Icons/Icons";
import { cx } from "../../cx";
import styles from "./ListingDetected.module.css";

const MARKER: Record<string, string> = {
  kind: "Kind",
  price: "Price",
};

function Line({ line }: { line: AnalysisLine }) {
  return (
    <li className={cx(styles.line, "type-body-sm")}>
      {line.status === "note" ? (
        <ExclamationIcon size={18} />
      ) : (
        <span className={cx(styles.marker, "type-label")}>
          {MARKER[line.id]}
        </span>
      )}
      {line.text}
    </li>
  );
}

export function AnalysisCard({ listing }: { listing: Listing }) {
  const { kind, price, notes } = analyseListing(listing);
  return (
    <Card title="About this listing">
      <ul className={styles.lines}>
        <Line line={kind} />
        <Line line={price} />
      </ul>
      <p className={cx(styles.label, "type-label")}>Worth a second look</p>
      <ul className={styles.lines}>
        {notes.length === 0 ? (
          <li className={cx(styles.line, "type-body-sm")}>
            <TickIcon size={18} />
            Nothing on the page stood out.
          </li>
        ) : (
          notes.map((note) => <Line key={note.id} line={note} />)
        )}
      </ul>
    </Card>
  );
}
