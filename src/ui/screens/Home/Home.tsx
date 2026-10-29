// What a user with a profile sees: the listing in the active tab, or a calm
// screen that says what Kiezpigeon needs when the tab is not a listing.
import type { Profile } from "../../../rules/types";
import { cx } from "../../cx";
import { useActiveListing } from "../../hooks/useActiveListing";
import { ListingDetected } from "../ListingDetected/ListingDetected";
import screen from "../Screen.module.css";

export function Home({ profile }: { profile: Profile }) {
  const active = useActiveListing();
  if (active.kind === "loading") return null;
  if (active.kind === "listing") {
    return (
      <ListingDetected
        profile={profile}
        siteName={active.siteName}
        listing={active.listing}
      />
    );
  }
  return <NoListing name={profile.applicants[0]?.firstName} />;
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
