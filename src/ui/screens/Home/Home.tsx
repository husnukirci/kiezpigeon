// What a user with a profile sees: the listing in the active tab and, after
// "Write my letter", its letter; or, when the tab is not a listing
// Kiezpigeon knows, the offer to use the page anyway (ADR 12).
import { panelTabId } from "../../../messaging/panel";
import type { Profile } from "../../../rules/types";
import { useActiveListing } from "../../hooks/useActiveListing";
import { UnknownSite } from "../UnknownSite/UnknownSite";
import { ListingFlow } from "./ListingFlow";

export function Home({ profile }: { profile: Profile }) {
  const ownTab = panelTabId(window.location.search);
  const active = useActiveListing(ownTab);
  if (active.kind === "loading") return null;
  if (active.kind === "listing") {
    return (
      <ListingFlow
        ownTab={ownTab}
        profile={profile}
        siteName={active.siteName}
        listing={active.listing}
      />
    );
  }
  return <UnknownSite ownTab={ownTab} profile={profile} />;
}
