// One listing from "Listing detected" to "Letter ready": the listing screen
// until "Write my letter", then the letter with its tab's contact form. On
// an unknown site (ADR 12) the facts were typed, so the listing screen has
// a Back to them, the form is read through the injected reader, and the
// form card lists every pair for the user to confirm before filling. A fill
// that wrote keeps the letter in the tracker, marked filled; "Yes, I sent
// it" marks it sent.
import { useState, type ComponentProps } from "react";
import { injectFallback } from "../../../messaging/fallback";
import { createLetterRequest } from "../../../rules/letterPrompt";
import { newApplication, refill, setStatus } from "../../../rules/tracker";
import type { Listing, Profile } from "../../../rules/types";
import { addApplication, changeApplication } from "../../../storage/storage";
import { useAnalysis } from "../../hooks/useAnalysis";
import { useContactForm } from "../../hooks/useContactForm";
import { useLetter } from "../../hooks/useLetter";
import { useStored } from "../../hooks/useStored";
import { LetterReady } from "../LetterReady/LetterReady";
import {
  ListingDetected,
  type LetterChoice,
} from "../ListingDetected/ListingDetected";

interface ListingFlowProps {
  ownTab: number | undefined;
  profile: Profile;
  siteName: string;
  listing: Listing;
  /** Pages the panel's tab has loaded; the form is read again on each.
   *  UnknownSite starts over per page instead, so it passes none. */
  pageLoads?: number;
  /** Set on a site without an adapter, where the user typed the facts. */
  unknownSite?: { onEditFacts: () => void } | undefined;
}

export function ListingFlow({
  ownTab,
  profile,
  siteName,
  listing,
  pageLoads = 0,
  unknownSite,
}: ListingFlowProps) {
  const letter = useLetter();
  const analysis = useAnalysis(ownTab, profile);
  const [letterOpen, setLetterOpen] = useState(false);
  const { state } = letter;
  // The letter belongs to the listing it was written for; another tab's
  // listing starts on its own listing screen.
  const ours =
    state.status !== "idle" && state.request.listing.url === listing.url
      ? state
      : undefined;

  if (ours && letterOpen) {
    return (
      <LetterScreen
        ownTab={ownTab}
        pageLoads={pageLoads}
        unknownSite={unknownSite !== undefined}
        state={ours}
        profile={profile}
        listing={listing}
        onTone={(tone) => {
          letter.write({ ...ours.request, tone });
        }}
        onRewrite={() => {
          letter.write(ours.request);
        }}
        onBack={() => {
          setLetterOpen(false);
        }}
      />
    );
  }

  const lastChoice: LetterChoice | undefined = ours && {
    tone: ours.request.tone,
    features: ours.request.features,
  };
  return (
    <ListingDetected
      key={listing.url}
      profile={profile}
      siteName={siteName}
      listing={listing}
      initialChoice={lastChoice}
      onEditFacts={unknownSite?.onEditFacts}
      analysis={{
        state: analysis.stateFor(listing.url),
        onAnalyse: () => {
          analysis.analyse(listing);
        },
      }}
      onWrite={(choice) => {
        letter.write(createLetterRequest(profile, listing, choice));
        setLetterOpen(true);
      }}
    />
  );
}

type LetterScreenProps = Omit<
  ComponentProps<typeof LetterReady>,
  | "form"
  | "onCheckForm"
  | "onFill"
  | "confirmFirst"
  | "listingTitle"
  | "saved"
  | "saveFailed"
  | "onFilled"
  | "onSent"
> & {
  ownTab: number | undefined;
  pageLoads: number;
  unknownSite: boolean;
  listing: Listing;
};

/** The letter screen with its tab's contact form, read when it opens, and
 *  the tracker's record for its listing. */
function LetterScreen({
  ownTab,
  pageLoads,
  unknownSite,
  listing,
  ...props
}: LetterScreenProps) {
  const form = useContactForm(
    ownTab,
    unknownSite ? injectFallback : undefined,
    pageLoads,
  );
  const applications = useStored("applications");
  const [saveFailed, setSaveFailed] = useState<string>();
  const saved =
    applications.status === "ready"
      ? applications.value?.find((a) => a.listingUrl === listing.url)
      : undefined;

  const failed = (what: string) => (error: unknown) => {
    setSaveFailed(`${what}: ${String(error)}`);
  };
  const add = (letter: string, status: "filled" | "sent"): Promise<void> =>
    addApplication(
      newApplication(listing, letter, {
        now: new Date().toISOString(),
        random: crypto.randomUUID().replaceAll("-", "").slice(0, 12),
        status,
      }),
    );

  // The fill wrote: the letter is a pigeon from now on. A second fill while
  // it is still only filled carries the newer letter over.
  const onFilled = (letter: string): void => {
    setSaveFailed(undefined);
    const kept = saved
      ? changeApplication(saved.id, (a) => refill(a, letter))
      : add(letter, "filled");
    kept.catch(failed("It could not be kept in your pigeons"));
  };

  // Only the user says it was sent. Without a record (the fill's save
  // failed, or the list was still loading) the sent one is made here.
  const onSent = (letter: string): void => {
    setSaveFailed(undefined);
    const marked = saved
      ? changeApplication(saved.id, (a) =>
          setStatus(a, "sent", new Date().toISOString()),
        )
      : add(letter, "sent");
    marked.catch(failed("It could not be marked sent"));
  };

  return (
    <LetterReady
      {...props}
      listingTitle={listing.title}
      confirmFirst={unknownSite}
      form={form.state}
      onCheckForm={form.check}
      onFill={form.fill}
      saved={saved}
      saveFailed={saveFailed}
      onFilled={onFilled}
      onSent={onSent}
    />
  );
}
