// A tab Kiezpigeon has no adapter for (ADR 12): it says what it needs, and
// offers "Use this page". Only that click puts the fallback reader into the
// page; then the user types the listing's facts, and the listing flow runs
// on exactly those, with a confirm step before anything is filled.
import { useState } from "react";
import { injectFallback } from "../../../messaging/fallback";
import {
  EMPTY_FACTS,
  listingFromFacts,
  type FactProblem,
  type ListingFacts,
} from "../../../rules/typedListing";
import type { Listing, Profile } from "../../../rules/types";
import { Button } from "../../components/Button/Button";
import { ExclamationIcon } from "../../components/Icons/Icons";
import { SelectField, TextField } from "../../components/TextField/TextField";
import { cx } from "../../cx";
import { panelTab } from "../../hooks/useActiveListing";
import { ListingFlow } from "../Home/ListingFlow";
import screen from "../Screen.module.css";
import styles from "./UnknownSite.module.css";

type Step =
  | { step: "start"; reading: boolean; failed: boolean }
  | { step: "facts"; url: string }
  | { step: "listing"; url: string; listing: Listing };

interface UnknownSiteProps {
  ownTab: number | undefined;
  profile: Profile;
}

export function UnknownSite({ ownTab, profile }: UnknownSiteProps) {
  const [step, setStep] = useState<Step>({
    step: "start",
    reading: false,
    failed: false,
  });
  // Kept across Back, so the user changes facts rather than retyping them.
  const [facts, setFacts] = useState<ListingFacts>(EMPTY_FACTS);

  const usePage = (): void => {
    setStep({ step: "start", reading: true, failed: false });
    panelTab(ownTab)
      .then((tabId) => {
        if (tabId === undefined) throw new Error("No tab");
        return injectFallback(tabId);
      })
      .then(
        (url) => {
          setStep({ step: "facts", url });
        },
        () => {
          setStep({ step: "start", reading: false, failed: true });
        },
      );
  };

  switch (step.step) {
    case "start":
      return (
        <Start
          name={profile.applicants[0]?.firstName}
          reading={step.reading}
          failed={step.failed}
          onUsePage={usePage}
        />
      );
    case "facts":
      return (
        <FactsScreen
          site={hostOf(step.url)}
          facts={facts}
          onChange={setFacts}
          onBack={() => {
            setStep({ step: "start", reading: false, failed: false });
          }}
          onDone={(listing) => {
            setStep({ step: "listing", url: step.url, listing });
          }}
          url={step.url}
        />
      );
    case "listing":
      return (
        <ListingFlow
          ownTab={ownTab}
          profile={profile}
          siteName={hostOf(step.url)}
          listing={step.listing}
          unknownSite={{
            onEditFacts: () => {
              setStep({ step: "facts", url: step.url });
            },
          }}
        />
      );
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

interface StartProps {
  name: string | undefined;
  reading: boolean;
  failed: boolean;
  onUsePage: () => void;
}

function Start({ name, reading, failed, onUsePage }: StartProps) {
  return (
    <section className={screen.screen} aria-labelledby="home-title">
      <div className={screen.heading}>
        <h1 id="home-title" className={cx(screen.title, "type-title-lg")}>
          {name ? `Ready when you are, ${name}` : "Ready when you are"}
        </h1>
        <p className={cx(screen.lead, "type-body")}>
          Open a flat listing on ImmoScout24 to get started.
        </p>
        <p className={cx(screen.lead, "type-body-sm")}>
          Kiezpigeon reads the listing page itself, the one with the rent, the
          size and the contact person. If a listing is already open, reload the
          page.
        </p>
        <p className={cx(screen.lead, "type-body-sm")}>
          On another site with a contact form? Kiezpigeon can still write your
          letter and fill the form there. You type what the listing says, and
          you check every field before anything is filled.
        </p>
      </div>
      {failed && (
        <p className={cx(styles.failure, "type-body-sm")} role="alert">
          <ExclamationIcon size={18} />
          Kiezpigeon cannot read this page. Click the Kiezpigeon icon in the
          toolbar while this page is open, then try again. Browser pages, such
          as a new tab, cannot be read.
        </p>
      )}
      <div className={screen.actions}>
        <Button kind="primary" disabled={reading} onClick={onUsePage}>
          Use this page
        </Button>
      </div>
    </section>
  );
}

const SALUTATIONS = [
  { value: "", label: "None" },
  { value: "Frau", label: "Frau" },
  { value: "Herr", label: "Herr" },
] as const;

interface FactsScreenProps {
  site: string;
  url: string;
  facts: ListingFacts;
  onChange: (facts: ListingFacts) => void;
  onBack: () => void;
  onDone: (listing: Listing) => void;
}

function FactsScreen({
  site,
  url,
  facts,
  onChange,
  onBack,
  onDone,
}: FactsScreenProps) {
  const [problems, setProblems] = useState<FactProblem[]>([]);
  const errorOf = (field: keyof ListingFacts): string | undefined =>
    problems.find((p) => p.field === field)?.message;
  const set = (change: Partial<ListingFacts>): void => {
    onChange({ ...facts, ...change });
  };

  return (
    <section className={screen.screen} aria-labelledby="facts-title">
      <div className={screen.heading}>
        <h1 id="facts-title" className={cx(screen.title, "type-title-lg")}>
          About this flat
        </h1>
        <p className={cx(screen.lead, "type-body-sm")}>
          Kiezpigeon does not know {site}, so type what the listing says. Only
          what you type goes into the fit check and your letter. Leave out what
          the listing does not say.
        </p>
      </div>

      <div className={styles.fields}>
        <TextField
          label="Listing title"
          value={facts.title}
          onChange={(title) => {
            set({ title });
          }}
        />
        <div className={styles.pair}>
          <TextField
            label="Kaltmiete in €"
            inputMode="decimal"
            value={facts.kaltmiete}
            error={errorOf("kaltmiete")}
            onChange={(kaltmiete) => {
              set({ kaltmiete });
            }}
          />
          <TextField
            label="Warmmiete in €"
            inputMode="decimal"
            value={facts.warmmiete}
            error={errorOf("warmmiete")}
            onChange={(warmmiete) => {
              set({ warmmiete });
            }}
          />
        </div>
        <div className={styles.narrowWide}>
          <SelectField
            label="Salutation"
            value={facts.salutation}
            options={SALUTATIONS}
            onChange={(salutation) => {
              set({ salutation });
            }}
          />
          <TextField
            label="Contact person's last name"
            value={facts.contactLastName}
            error={errorOf("contactLastName")}
            onChange={(contactLastName) => {
              set({ contactLastName });
            }}
          />
        </div>
        <TextField
          label="Features, separated by commas"
          placeholder="Balkon, Altbau"
          value={facts.features}
          onChange={(features) => {
            set({ features });
          }}
        />
      </div>

      <div className={cx(screen.actions, styles.bottom)}>
        <Button className={screen.back} onClick={onBack}>
          Back
        </Button>
        <Button
          kind="primary"
          onClick={() => {
            const result = listingFromFacts(facts, url);
            if (result.ok) onDone(result.value);
            else setProblems(result.problems);
          }}
        >
          Continue
        </Button>
      </div>
    </section>
  );
}
