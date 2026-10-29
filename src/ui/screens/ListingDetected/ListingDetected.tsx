// "Listing detected" (design system screen 2): the badge, title and meta
// line, three stat tiles, the fit check, tone and up to two highlights.
// The letter itself arrives in Phase 4; until then the button is disabled.
import { useId, useState } from "react";
import { checkFit } from "../../../rules/fit";
import {
  formatArea,
  formatEuro,
  formatFloor,
  formatNumber,
} from "../../../rules/format";
import type {
  Feature,
  FitLine,
  Listing,
  Profile,
  Tone,
} from "../../../rules/types";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { StatRow, StatTile } from "../../components/Card/StatTile";
import { ChipRow, ToggleChip } from "../../components/Chip/Chip";
import { ExclamationIcon, TickIcon } from "../../components/Icons/Icons";
import { SegmentedControl } from "../../components/SegmentedControl/SegmentedControl";
import { DetectedBadge } from "../../components/StatusPill/StatusPill";
import { cx } from "../../cx";
import { TONES } from "../profileForm/ProfileSections";
import screen from "../Screen.module.css";
import styles from "./ListingDetected.module.css";

const MAX_HIGHLIGHTS = 2;

interface ListingDetectedProps {
  profile: Profile;
  siteName: string;
  listing: Listing;
}

export function ListingDetected({
  profile,
  siteName,
  listing,
}: ListingDetectedProps) {
  const [tone, setTone] = useState<Tone>(profile.letterDefaults.tone);
  const meta = metaLine(listing);

  return (
    <section className={screen.screen} aria-labelledby="listing-title">
      <div className={screen.heading}>
        <DetectedBadge siteName={siteName} />
        <h1 id="listing-title" className={cx(screen.title, "type-title-lg")}>
          {listing.title ?? "Untitled listing"}
        </h1>
        {meta && <p className={cx(screen.lead, "type-body-sm")}>{meta}</p>}
      </div>

      <StatRow>
        <StatTile label="Kaltmiete" value={money(listing.kaltmieteCents)} />
        <StatTile label="Warmmiete" value={money(listing.warmmieteCents)} />
        <StatTile
          label="Rooms"
          value={
            listing.rooms === undefined
              ? undefined
              : formatNumber(listing.rooms, 1)
          }
        />
      </StatRow>

      <FitCard lines={checkFit(profile, listing)} />

      <SegmentedControl
        label="Tone"
        options={TONES}
        value={tone}
        onChange={setTone}
      />

      <Highlights key={listing.url} features={listing.features} />

      <div className={cx(screen.actions, styles.write)}>
        <Button kind="primary" disabled aria-describedby="write-next">
          Write my letter
        </Button>
      </div>
      <p id="write-next" className={cx(styles.next, "type-caption")}>
        Coming next
      </p>
    </section>
  );
}

function money(cents: number | undefined): string | undefined {
  return cents === undefined ? undefined : formatEuro(cents);
}

/** `Prenzlauer Berg · 62 m² · 2. OG`, leaving out what the page lacks. */
function metaLine(listing: Listing): string {
  return [
    listing.district,
    listing.areaM2 === undefined ? undefined : formatArea(listing.areaM2),
    listing.floor === undefined ? undefined : formatFloor(listing.floor),
  ]
    .filter((part) => part !== undefined)
    .join(" · ");
}

function FitCard({ lines }: { lines: FitLine[] }) {
  return (
    <Card title="Fit check">
      <ul className={styles.lines}>
        {lines.map((line) => (
          <li key={line.rule} className={cx(styles.line, "type-body-sm")}>
            {line.status === "ok" ? (
              <TickIcon size={18} />
            ) : (
              <ExclamationIcon size={18} />
            )}
            {line.reason}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Highlights({ features }: { features: Feature[] }) {
  const labelId = useId();
  const [chosen, setChosen] = useState<Feature[]>(() =>
    features.slice(0, MAX_HIGHLIGHTS),
  );
  const [full, setFull] = useState(false);

  if (features.length === 0) {
    return (
      <p className={cx(screen.lead, "type-body-sm")}>
        This listing names no features to highlight. Your letter will lead with
        you instead.
      </p>
    );
  }

  const toggle = (feature: Feature): void => {
    if (chosen.includes(feature)) {
      setChosen(chosen.filter((f) => f !== feature));
      setFull(false);
    } else if (chosen.length < MAX_HIGHLIGHTS) {
      setChosen([...chosen, feature]);
      setFull(false);
    } else {
      setFull(true);
    }
  };

  return (
    <div className={styles.highlights}>
      <p id={labelId} className={cx(styles.label, "type-label")}>
        Highlights to mention
      </p>
      <div role="group" aria-labelledby={labelId}>
        <ChipRow>
          {features.map((feature) => (
            <ToggleChip
              key={feature}
              pressed={chosen.includes(feature)}
              onToggle={() => {
                toggle(feature);
              }}
            >
              {feature}
            </ToggleChip>
          ))}
        </ChipRow>
      </div>
      <p className={cx(styles.hint, "type-caption")} aria-live="polite">
        {full
          ? "You can pick two. Unpick one to choose another."
          : "Pick one or two for your letter."}
      </p>
    </div>
  );
}
