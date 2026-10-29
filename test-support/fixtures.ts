// Loads a scrubbed listing page from fixtures/ as a Document. Refuses a
// file without the scrub mark, so an unscrubbed page cannot become a test.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCRUB_MARK =
  "<!-- scrubbed: names, phones, emails, addresses, ids replaced -->";

export function loadFixture(site: string, name: string): Document {
  const html = readFileSync(
    join(import.meta.dirname, "..", "fixtures", site, name),
    "utf8",
  );
  if (!html.startsWith(SCRUB_MARK)) {
    throw new Error(`${site}/${name} does not start with the scrub mark`);
  }
  return new DOMParser().parseFromString(html, "text/html");
}
