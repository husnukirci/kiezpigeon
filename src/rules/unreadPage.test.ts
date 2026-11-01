import { describe, expect, it } from "vitest";
import { unreadPage } from "./unreadPage";

const SITE = "https://www.immobilienscout24.de";

describe("unreadPage", () => {
  it("calls an ImmoScout24 page that is not an exposé not a listing", () => {
    for (const url of [
      `${SITE}/`,
      `${SITE}/Suche/de/berlin/berlin/wohnung-mieten`,
      `${SITE}/en/`,
      `${SITE}/expose/`,
      `${SITE}/expose/abc`,
    ]) {
      expect(unreadPage(url, false)).toBe("immoscout24_not_listing");
    }
  });

  it("asks for a reload on an exposé whose content script does not answer", () => {
    expect(unreadPage(`${SITE}/expose/100000009`, false)).toBe("reload_tab");
    expect(unreadPage(`${SITE}/expose/100000009?ref=x`, false)).toBe(
      "reload_tab",
    );
    expect(unreadPage(`${SITE}/en/expose/100000009`, false)).toBe("reload_tab");
  });

  it("believes a content script that answered: that exposé has no listing", () => {
    expect(unreadPage(`${SITE}/expose/100000009`, true)).toBe(
      "immoscout24_not_listing",
    );
  });

  it("believes the answer when the address cannot be read", () => {
    // The icon's grant ends when the tab changes origin; only ImmoScout24's
    // content script answers, so the answer alone names the site.
    expect(unreadPage(undefined, true)).toBe("immoscout24_not_listing");
  });

  it("offers the fallback on any other site", () => {
    expect(unreadPage("https://flats.example/wohnung/17", false)).toBe(
      "other_site",
    );
  });

  it("offers the fallback when the address cannot be read", () => {
    expect(unreadPage(undefined, false)).toBe("other_site");
  });

  it("is not fooled by a look-alike address", () => {
    for (const url of [
      "https://www.immobilienscout24.de.flats.example/expose/100000009",
      "https://flats.example/www.immobilienscout24.de/expose/100000009",
      "http://www.immobilienscout24.de/expose/100000009",
    ]) {
      expect(unreadPage(url, false)).toBe("other_site");
    }
  });
});
