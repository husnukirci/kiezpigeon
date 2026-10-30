// An ImmoScout24 tab Kiezpigeon cannot read as a listing, and what to do
// about it. The unknown-site fallback is not offered: this site has an
// adapter, so typing the facts would only hide the problem.
import type { Profile } from "../../../rules/types";
import type { UnreadPage } from "../../../rules/unreadPage";
import { cx } from "../../cx";
import screen from "../Screen.module.css";

const REASONS: Record<Exclude<UnreadPage, "other_site">, string> = {
  immoscout24_not_listing:
    "This ImmoScout24 page is not a listing. Open a listing to start.",
  reload_tab: "Reload this tab so Kiezpigeon can read it.",
};

interface PageNotReadProps {
  page: Exclude<UnreadPage, "other_site">;
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
        <p className={cx(screen.lead, "type-body")}>{REASONS[page]}</p>
      </div>
    </section>
  );
}
