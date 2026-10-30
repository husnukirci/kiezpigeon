// "Your pigeons" (design system screen 4): stat tiles, filter chips, one row
// per application with its status pill, a status change and the listing
// link, then the pigeon's tip. Counts and order come from the rules core's
// tracker; this screen only shows them.
import { useState } from "react";
import { formatDate, formatEuro } from "../../../rules/format";
import {
  filterApplications,
  setStatus,
  trackerStats,
  type TrackerFilter,
  type TrackerStats,
} from "../../../rules/tracker";
import type { Application, ApplicationStatus } from "../../../rules/types";
import { changeApplication } from "../../../storage/storage";
import { cx } from "../../cx";
import { Button, buttonClassName } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { StatRow, StatTile } from "../../components/Card/StatTile";
import { ChipRow, FilterChip } from "../../components/Chip/Chip";
import {
  ApplicationPill,
  STATUS_WORD,
} from "../../components/StatusPill/StatusPill";
import { useStored } from "../../hooks/useStored";
import screen from "../Screen.module.css";
import styles from "./Tracker.module.css";

const FILTERS: { value: TrackerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "viewing", label: "Viewing" },
  { value: "closed", label: "Closed" },
];

const STATUSES: ApplicationStatus[] = ["sent", "viewing", "closed"];

export function Tracker({ onClose }: { onClose: () => void }) {
  const stored = useStored("applications");
  const [filter, setFilter] = useState<TrackerFilter>("all");
  const [failed, setFailed] = useState<string>();
  const now = new Date().toISOString();

  const onStatus = (id: string, status: ApplicationStatus): void => {
    setFailed(undefined);
    const changedAt = new Date().toISOString();
    changeApplication(id, (a) => setStatus(a, status, changedAt)).catch(
      (error: unknown) => {
        setFailed(`The status could not be saved: ${String(error)}`);
      },
    );
  };

  let content;
  if (stored.status === "loading") {
    content = null;
  } else if (stored.status === "invalid") {
    content = (
      <Card title="Your applications could not be read">
        <p className={cx(styles.muted, "type-body-sm")}>
          Open settings to import an export, or to start again with delete all
          data.
        </p>
        <ul className={cx(styles.muted, "type-caption")}>
          {stored.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </Card>
    );
  } else {
    const applications = stored.value ?? [];
    const stats = trackerStats(applications, now);
    const shown = filterApplications(applications, filter);
    content = (
      <>
        <StatRow>
          <StatTile label="Sent" value={String(stats.total)} />
          <StatTile label="Viewings" value={String(stats.viewing)} positive />
          <StatTile label="Waiting" value={String(stats.sent)} />
        </StatRow>

        <ChipRow label="Filter">
          {FILTERS.map(({ value, label }) => (
            <FilterChip
              key={value}
              pressed={filter === value}
              onToggle={() => {
                setFilter(value);
              }}
            >
              {label}
            </FilterChip>
          ))}
        </ChipRow>

        {failed && (
          <p className={cx(styles.warn, "type-body-sm")} role="alert">
            {failed}
          </p>
        )}

        {applications.length > 0 &&
          (shown.length === 0 ? (
            <p className={cx(styles.muted, "type-body-sm")}>
              No applications marked{" "}
              {FILTERS.find((f) => f.value === filter)?.label}.
            </p>
          ) : (
            <ul className={styles.rows} aria-label="Applications">
              {shown.map((application) => (
                <ApplicationRow
                  key={application.id}
                  application={application}
                  onStatus={(status) => {
                    onStatus(application.id, status);
                  }}
                />
              ))}
            </ul>
          ))}

        <Card title="Pigeon tip">
          <p className={cx(styles.muted, "type-body-sm")}>{tip(stats)}</p>
        </Card>
      </>
    );
  }

  return (
    <section className={screen.screen} aria-labelledby="tracker-title">
      <div className={screen.heading}>
        <h1 id="tracker-title" className={cx(screen.title, "type-title-lg")}>
          Your pigeons
        </h1>
      </div>

      {content}

      <div className={screen.actions}>
        <Button kind="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </section>
  );
}

function ApplicationRow({
  application,
  onStatus,
}: {
  application: Application;
  onStatus: (status: ApplicationStatus) => void;
}) {
  const { listingTitle, listingUrl, status } = application;
  return (
    <li className={cx(styles.row, status === "closed" && styles.closed)}>
      <div className={styles.head}>
        <p className={cx(styles.title, "type-body")}>
          {listingTitle ?? new URL(listingUrl).hostname}
        </p>
        <ApplicationPill status={status} />
      </div>
      <p className={cx(styles.meta, "type-caption")}>{meta(application)}</p>
      <div className={styles.actions}>
        <a
          className={buttonClassName("secondary")}
          href={listingUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open listing
        </a>
        {STATUSES.filter((s) => s !== status).map((next) => (
          <Button
            key={next}
            onClick={() => {
              onStatus(next);
            }}
          >
            Mark as {STATUS_WORD[next].toLowerCase()}
          </Button>
        ))}
      </div>
    </li>
  );
}

/** "Kreuzberg · 1.400 € Warmmiete · sent 01.02.2027", in local time. */
function meta({ district, warmmieteCents, sentAt }: Application): string {
  const sent = new Date(sentAt);
  const day = [
    sent.getFullYear(),
    String(sent.getMonth() + 1).padStart(2, "0"),
    String(sent.getDate()).padStart(2, "0"),
  ].join("-");
  return [
    district,
    warmmieteCents !== undefined && `${formatEuro(warmmieteCents)} Warmmiete`,
    `sent ${formatDate(day)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The pigeon speaks in first person (design system "Voice"). */
function tip(stats: TrackerStats): string {
  if (stats.total === 0) {
    return 'Nothing here yet. After you send a letter I filled in, answer "Did you send it?" on the letter screen and I\'ll keep it here.';
  }
  if (stats.viewing > 0) {
    return "You have a Besichtigung. Take your documents along, so you can hand them over on the day.";
  }
  if (stats.sentLast7Days === 0) {
    return "No letters this week. New listings go quickly, so a short look each day helps.";
  }
  const letters =
    stats.sentLast7Days === 1 ? "1 letter" : `${stats.sentLast7Days} letters`;
  return `${letters} this week. Many landlords answer only the people they invite, so no reply is normal. I'll keep count.`;
}
