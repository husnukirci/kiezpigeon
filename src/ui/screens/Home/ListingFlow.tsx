// One listing from "Listing detected" to "Letter ready": the listing screen
// until "Write my letter", then the letter with its tab's contact form. On
// an unknown site (ADR 12) the facts were typed, so the listing screen has
// a Back to them, the form is read through the injected reader, and the
// form card lists every pair for the user to confirm before filling.
import { useState, type ComponentProps } from "react";
import { injectFallback } from "../../../messaging/fallback";
import { createLetterRequest } from "../../../rules/letterPrompt";
import type { Listing, Profile } from "../../../rules/types";
import { useContactForm } from "../../hooks/useContactForm";
import { useLetter } from "../../hooks/useLetter";
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
  /** Set on a site without an adapter, where the user typed the facts. */
  unknownSite?: { onEditFacts: () => void } | undefined;
}

export function ListingFlow({
  ownTab,
  profile,
  siteName,
  listing,
  unknownSite,
}: ListingFlowProps) {
  const letter = useLetter();
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
        unknownSite={unknownSite !== undefined}
        state={ours}
        profile={profile}
        listingTitle={listing.title}
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
      onWrite={(choice) => {
        letter.write(createLetterRequest(profile, listing, choice));
        setLetterOpen(true);
      }}
    />
  );
}

type LetterScreenProps = Omit<
  ComponentProps<typeof LetterReady>,
  "form" | "onCheckForm" | "onFill" | "confirmFirst"
> & { ownTab: number | undefined; unknownSite: boolean };

/** The letter screen with its tab's contact form, read when it opens. */
function LetterScreen({ ownTab, unknownSite, ...props }: LetterScreenProps) {
  const form = useContactForm(ownTab, unknownSite ? injectFallback : undefined);
  return (
    <LetterReady
      {...props}
      confirmFirst={unknownSite}
      form={form.state}
      onCheckForm={form.check}
      onFill={form.fill}
    />
  );
}
