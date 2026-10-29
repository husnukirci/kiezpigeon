// What a user with a profile sees until listing detection arrives (Phase 3).
import type { Profile } from "../../../rules/types";
import { cx } from "../../cx";
import screen from "../Screen.module.css";

export function Home({ profile }: { profile: Profile }) {
  const name = profile.applicants[0]?.firstName;
  return (
    <section className={screen.screen} aria-labelledby="home-title">
      <div className={screen.heading}>
        <h1 id="home-title" className={cx(screen.title, "type-title-lg")}>
          {name ? `Ready when you are, ${name}` : "Ready when you are"}
        </h1>
        <p className={cx(screen.lead, "type-body")}>
          Open a flat listing on ImmoScout24 to get started.
        </p>
      </div>
    </section>
  );
}
