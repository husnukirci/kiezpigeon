// A tab on a known site that Kiezpigeon cannot read as a listing, and what to do
// about it. The unknown-site fallback is not offered: this site has an
// adapter, so typing the facts would only hide the problem.
import type { Profile } from "../../../rules/types";
import type { UnreadPage } from "../../../rules/unreadPage";
import { cx } from "../../cx";
import screen from "../Screen.module.css";

function reason(page: Exclude<UnreadPage, { reason: "other_site" }>): string {
  return page.reason === "reload_tab"
    ? "Reload this tab so Kiezpigeon can read it."
    : `This ${page.siteName} page is not a listing. Open a listing to start.`;
}

interface PageNotReadProps {
  page: Exclude<UnreadPage, { reason: "other_site" }>;
  profile: Profile;
}

export function PageNotRead({ page, profile }: PageNotReadProps) {
  const name = profile.applicants[0]?.firstName;
  return (
    <section className={screen.screen} aria-labelledby="home-title">
      <div className={screen.heading}>
        <h1 id="home-title" className={cx(screen.title, "type-title-lg")}>
          {name ? `Ready when you are, ${name}` : "Ready when you are"}
        </h1>
        <p className={cx(screen.lead, "type-body")}>{reason(page)}</p>
      </div>
    </section>
  );
}
