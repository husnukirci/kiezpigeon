// What a user with a profile sees: the listing in the active tab and, after
// "Write my letter", its letter; or a calm screen that says what Kiezpigeon
// needs when the tab is not a listing.
import { useState } from "react";
import { createLetterRequest } from "../../../rules/letterPrompt";
import type { Listing, Profile } from "../../../rules/types";
import { cx } from "../../cx";
import { useActiveListing } from "../../hooks/useActiveListing";
import { useLetter } from "../../hooks/useLetter";
import { LetterReady } from "../LetterReady/LetterReady";
import {
  ListingDetected,
  type LetterChoice,
} from "../ListingDetected/ListingDetected";
import screen from "../Screen.module.css";

export function Home({ profile }: { profile: Profile }) {
  const active = useActiveListing();
  if (active.kind === "loading") return null;
  if (active.kind === "listing") {
    return (
      <ListingFlow
        profile={profile}
        siteName={active.siteName}
        listing={active.listing}
      />
    );
  }
  return <NoListing name={profile.applicants[0]?.firstName} />;
}

interface ListingFlowProps {
  profile: Profile;
  siteName: string;
  listing: Listing;
}

function ListingFlow({ profile, siteName, listing }: ListingFlowProps) {
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
      <LetterReady
        state={ours}
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
      onWrite={(choice) => {
        letter.write(createLetterRequest(profile, listing, choice));
        setLetterOpen(true);
      }}
    />
  );
}

function NoListing({ name }: { name: string | undefined }) {
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
      </div>
    </section>
  );
}
