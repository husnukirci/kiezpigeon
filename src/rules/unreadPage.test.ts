import { describe, expect, it } from "vitest";
import { unreadPage } from "./unreadPage";

const SITE = "https://www.immobilienscout24.de";
const VONOVIA = "https://www.vonovia.de/zuhause-finden";
const notListing = (siteName: string) => ({
  reason: "not_listing",
  siteName,
});
const RELOAD = { reason: "reload_tab" };
const OTHER = { reason: "other_site" };

describe("unreadPage", () => {
  it("calls an ImmoScout24 page that is not an exposé not a listing", () => {
    for (const url of [
      `${SITE}/`,
      `${SITE}/Suche/de/berlin/berlin/wohnung-mieten`,
      `${SITE}/en/`,
      `${SITE}/expose/`,
      `${SITE}/expose/abc`,
    ]) {
      expect(unreadPage(url, undefined)).toEqual(notListing("ImmoScout24"));
    }
  });

  it("calls a Vonovia page that is not a listing not a listing", () => {
    for (const url of [
      "https://www.vonovia.de/",
      VONOVIA,
      `${VONOVIA}/immobilien`,
      `${VONOVIA}/immobilien/`,
    ]) {
      expect(unreadPage(url, undefined)).toEqual(notListing("Vonovia"));
    }
  });

  it("asks for a reload on an exposé whose content script does not answer", () => {
    for (const url of [
      `${SITE}/expose/100000009`,
      `${SITE}/expose/100000009?ref=x`,
      `${SITE}/en/expose/100000009`,
      `${VONOVIA}/immobilien/helle-wohnung-82-1000000001`,
      `${VONOVIA}/immobilien/helle-wohnung-82-1000000001?em_src=x`,
    ]) {
      expect(unreadPage(url, undefined)).toEqual(RELOAD);
    }
  });

  it("believes a content script that answered: that page has no listing", () => {
    expect(unreadPage(`${SITE}/expose/100000009`, "ImmoScout24")).toEqual(
      notListing("ImmoScout24"),
    );
    expect(
      unreadPage(`${VONOVIA}/immobilien/x-82-1000000001`, "Vonovia"),
    ).toEqual(notListing("Vonovia"));
  });

  it("believes the answer when the address cannot be read", () => {
    // The icon's grant ends when the tab changes origin; the script that
    // answered names its site.
    expect(unreadPage(undefined, "Vonovia")).toEqual(notListing("Vonovia"));
  });

  it("offers the fallback on any other site", () => {
    expect(unreadPage("https://flats.example/wohnung/17", undefined)).toEqual(
      OTHER,
    );
  });

  it("offers the fallback when the address cannot be read", () => {
    expect(unreadPage(undefined, undefined)).toEqual(OTHER);
  });

  it("is not fooled by a look-alike address", () => {
    for (const url of [
      "https://www.immobilienscout24.de.flats.example/expose/100000009",
      "https://flats.example/www.immobilienscout24.de/expose/100000009",
      "http://www.immobilienscout24.de/expose/100000009",
      "https://www.vonovia.de.flats.example/zuhause-finden/immobilien/x-82-1",
      "http://www.vonovia.de/zuhause-finden/immobilien/x-82-1",
    ]) {
      expect(unreadPage(url, undefined)).toEqual(OTHER);
    }
  });
});
