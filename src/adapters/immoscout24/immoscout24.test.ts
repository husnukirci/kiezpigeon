// Fixture tests (PLAN.md section 5): each saved, scrubbed page and the
// exact Listing the adapter returns for it.
import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../test-support/fixtures";
import {
  coupleWithDog,
  soloStudent,
} from "../../../test-support/sample-profiles";
import { mapFields } from "../../rules/fieldMatch";
import { NO_HINTS } from "../../rules/rentalHints";
import { immoscout24 } from "./immoscout24";

const URL = "https://www.immobilienscout24.de/expose/100000003";
const PAIR_ID = "100000020";
const GERMAN_URL = `https://www.immobilienscout24.de/expose/${PAIR_ID}`;
const ENGLISH_URL = `https://www.immobilienscout24.de/en/expose/${PAIR_ID}`;

const englishPage = () =>
  loadFixture("immoscout24", "en-listing-complete.html");

describe("immoscout24.readListing", () => {
  it("reads a listing with missing fields and names what it lacks", () => {
    const listing = immoscout24.readListing(
      loadFixture("immoscout24", "listing-missing-fields.html"),
      URL,
    );
    expect(listing).toEqual({
      url: URL,
      title: "Teilmöbliert 2 Zimmer nähe U Bahn Osloer Straße",
      address: "Musterweg 5, Reinickendorf (Ortsteil), 13401 Berlin",
      district: "Reinickendorf",
      kaltmieteCents: 75000,
      nebenkostenCents: 20000,
      warmmieteCents: 95000,
      areaM2: 44,
      rooms: 2,
      // Near the end of the page: proves the whole fixture parsed.
      contactPerson: { firstName: "Lena", lastName: "Beispiel" },
      // The Kosten row reads a bare "1000"; the contact is "von privat";
      // the title says Teilmöbliert; the price block is empty on this page.
      kautionCents: 100000,
      offeredBy: "private",
      hints: { ...NO_HINTS, furnished: true },
      features: [],
      missing: [
        "floor",
        "availability",
        "yearBuilt",
        "petPolicy",
        "wbsRequired",
        "flatType",
        "priceComparison",
      ],
    });
  });

  it("reads a complete listing, with a company as the contact", () => {
    const listing = immoscout24.readListing(
      loadFixture("immoscout24", "listing-complete.html"),
      URL,
    );
    expect(listing).toEqual({
      url: URL,
      title: "Singlewohnung!",
      address: "Musterallee 9, Reinickendorf (Ortsteil), 13401 Berlin",
      district: "Reinickendorf",
      kaltmieteCents: 102829,
      nebenkostenCents: 12000,
      warmmieteCents: 121829,
      areaM2: 51.44,
      rooms: 1,
      floor: 1,
      availability: { kind: "date", date: "2027-02-01" },
      yearBuilt: 2016,
      petPolicy: "allowed",
      flatType: "Etagenwohnung",
      kautionCents: 308487,
      offeredBy: "commercial",
      // "Ø Angebotspreis" 9,70 to 17,90 €/m² over 500 flats within 1000 m.
      priceComparison: {
        lowCentsPerM2: 970,
        highCentsPerM2: 1790,
        radiusM: 1000,
        sampleSize: 500,
      },
      // Its text rules a Provision out under § 2 WoVermG: no hint.
      hints: NO_HINTS,
      features: ["Balkon", "Keller", "Personenaufzug", "Stufenloser Zugang"],
      // Neither saved page showed a WBS field; a company gets no name.
      missing: ["wbsRequired", "contactPerson"],
    });
  });

  it("reads a flat that is free now", () => {
    const now = immoscout24.readListing(
      loadFixture("immoscout24", "listing-available-now.html"),
      URL,
    );
    const complete = immoscout24.readListing(
      loadFixture("immoscout24", "listing-complete.html"),
      URL,
    );
    expect(now).toEqual({ ...complete, availability: { kind: "immediately" } });
  });

  it("reads no hints when the description block is gone", () => {
    const page = loadFixture("immoscout24", "listing-complete.html");
    page.querySelector(".expose-description-wrapper")?.remove();
    const listing = immoscout24.readListing(page, URL);
    expect(listing?.hints).toBeUndefined();
    expect(listing?.missing).toContain("hints");
  });

  it("leaves the price band out when one of its numbers is missing", () => {
    const page = loadFixture("immoscout24", "listing-complete.html");
    page.querySelector('[data-testid="quickcheck-intro"]')?.remove();
    const listing = immoscout24.readListing(page, URL);
    expect(listing?.priceComparison).toBeUndefined();
    expect(listing?.missing).toContain("priceComparison");
  });

  it("leaves the price band out when its legend is not the one under Ø Angebotspreis", () => {
    const page = loadFixture("immoscout24", "listing-complete.html");
    for (const label of page.querySelectorAll(
      '[data-testid="quickcheck-bar"] span',
    )) {
      if (/Angebotspreis/.test(label.textContent)) label.remove();
    }
    expect(immoscout24.readListing(page, URL)?.priceComparison).toBeUndefined();
  });

  it("says a search results page is not a listing", () => {
    const page = loadFixture("immoscout24", "search-results.html");
    // The two result cards made it through the parse.
    expect(page.querySelectorAll(".listing-card")).toHaveLength(2);
    expect(immoscout24.readListing(page, URL)).toBeUndefined();
  });

  it("reads a WBS row by its label", () => {
    // Invented markup in the shape of the page's criteria rows: no saved
    // page had a WBS field (docs/ai-workflow.md, Phase 3).
    const page = (value: string): Document =>
      new DOMParser().parseFromString(
        `<h1 data-qa="expose-title">Wohnung</h1>
         <dl><dt>Wohnberechtigungsschein</dt><dd>${value}</dd></dl>`,
        "text/html",
      );
    expect(
      immoscout24.readListing(page("erforderlich"), URL)?.wbsRequired,
    ).toBe(true);
    expect(
      immoscout24.readListing(page("nicht erforderlich"), URL)?.wbsRequired,
    ).toBe(false);
  });
});

describe("immoscout24.readContactForm", () => {
  const contactPage = () => loadFixture("immoscout24", "contact-form.html");

  it("reads nothing while the Nachricht dialog is closed", () => {
    const page = loadFixture("immoscout24", "listing-complete.html");
    expect(immoscout24.contactForm(page)).toBeUndefined();
    expect(immoscout24.readContactForm(page)).toEqual([]);
  });

  it("reads every field of the open dialog with its label and value", () => {
    const fields = immoscout24.readContactForm(contactPage());
    expect(
      fields.map((f) => [f.key, f.type, f.label, f.value ?? f.checked]),
    ).toEqual([
      ["name:message", "textarea", "Nachricht schreiben", ""],
      ["name:salutation", "select", "Anrede *", ""],
      ["name:firstName", "text", "Vorname *", "Jonas"],
      ["name:lastName", "text", "Nachname *", "Vorbelegt"],
      ["name:emailAddress", "text", "E-Mail *", "jonas.vorbelegt@example.org"],
      ["name:phoneNumber", "text", "Telefonnummer", "030 5550999"],
      ["name:street", "text", "Straße *", "Musterweg"],
      ["name:houseNumber", "text", "Hausnummer *", "12"],
      ["name:postcode", "text", "Postleitzahl *", "10115"],
      ["name:city", "text", "Ort *", "Berlin"],
      ["name:moveInDateType", "select", "Einzugstermin", ""],
      ["name:numberOfPersons", "select", "Haushaltsgröße", ""],
      [
        "name:hasPets",
        "select",
        "Haustiere (außer Kleintiere, z. B. Hamster)",
        "",
      ],
      ["name:employmentRelationship", "select", "Beschäftigungsart", ""],
      ["name:income", "select", "Monatliches netto Haushaltseinkommen", ""],
      [
        "name:applicationPackageCompleted",
        "select",
        "Bewerbungsunterlagen",
        "",
      ],
      [
        "name:sendUserProfile",
        "checkbox",
        "Anbieter:in darf dein Profil sehen",
        true,
      ],
      [
        "name:followAnAgent",
        "checkbox",
        "Anbieter:in folgen für Inserate & Profi-Tipps",
        true,
      ],
      [
        "id:is24-checkbox-isRelocationOfferChecked-input",
        "checkbox",
        "Erhalte Angebote von Umzugsfirmen",
        false,
      ],
    ]);
    expect(fields.find((f) => f.name === "emailAddress")?.disabled).toBe(true);
    expect(fields.find((f) => f.name === "hasPets")?.options).toEqual([
      { value: "", label: "" },
      { value: "TRUE", label: "Ja" },
      { value: "FALSE", label: "Nein" },
    ]);
  });

  it("maps to 14 of 15 for the couple, naming what it replaces", () => {
    const result = mapFields(
      immoscout24.readContactForm(contactPage()),
      coupleWithDog,
      "Sehr geehrte Frau Beispiel, ...",
    );
    expect(result).toMatchObject({ matched: 14, total: 15 });
    expect(
      result.mappings.map((m) => [m.field.name, m.value, m.replaces]),
    ).toEqual([
      ["message", "Sehr geehrte Frau Beispiel, ...", false],
      ["salutation", undefined, false],
      ["firstName", "Mara", true],
      ["lastName", "Testmann", true],
      ["phoneNumber", "030 5550123", true],
      ["street", "Erfundene Straße", true],
      ["houseNumber", "7", true],
      ["postcode", "10999", true],
      ["city", "Berlin", false],
      ["moveInDateType", "CONCRETE", false],
      ["numberOfPersons", "TWO_PERSON", false],
      ["hasPets", "TRUE", false],
      ["employmentRelationship", "PUBLIC_EMPLOYEE", false],
      ["income", "OVER_4000_UPTO_5000", false],
      ["applicationPackageCompleted", "TRUE", false],
    ]);
    expect(result.leftAlone.map((f) => f.label)).toEqual([
      "Anbieter:in darf dein Profil sehen",
      "Anbieter:in folgen für Inserate & Profi-Tipps",
      "Erhalte Angebote von Umzugsfirmen",
    ]);
  });

  it("keeps keys unique and reads no value from hidden, file or password inputs", () => {
    const page = contactPage();
    page
      .querySelector("[data-testid='contact-form']")
      ?.insertAdjacentHTML(
        "beforeend",
        '<input type="hidden" name="followAnAgent" value="tracking-token">' +
          '<input type="password" name="pw" value="secret">' +
          '<input type="file" name="cv">',
      );
    const fields = immoscout24.readContactForm(page);
    const keys = fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(fields.filter((f) => f.name === "followAnAgent")).toHaveLength(2);
    for (const name of ["followAnAgent", "pw", "cv"]) {
      const last = fields.filter((f) => f.name === name).at(-1);
      expect(last?.value).toBeUndefined();
    }
  });
});

describe("immoscout24.readListing on the English page", () => {
  it("reads the same flat as the German page of the same listing", () => {
    const german = immoscout24.readListing(
      loadFixture("immoscout24", "de-listing-pair.html"),
      GERMAN_URL,
    );
    const english = immoscout24.readListing(englishPage(), ENGLISH_URL);
    // The site translates the landlord's title and the flat type by
    // machine, so those and the address of the page are what legitimately
    // differ.
    expect({ ...english, url: "", title: "", flatType: "" }).toEqual({
      ...german,
      url: "",
      title: "",
      flatType: "",
    });
    expect(english?.url).toBe(ENGLISH_URL);
    expect(english?.title).toBeTruthy();
  });

  it("reads each figure from its English text", () => {
    expect(immoscout24.readListing(englishPage(), ENGLISH_URL)).toMatchObject({
      kaltmieteCents: 86500,
      nebenkostenCents: 24000,
      warmmieteCents: 110500,
      areaM2: 60.13,
      rooms: 2,
      floor: 5,
      availability: { kind: "date", date: "2025-11-01" },
      petPolicy: "not_allowed",
      flatType: "Other",
      // The Kaution row keeps the German number format on /en/.
      kautionCents: 259500,
      offeredBy: "commercial",
      // From the condition row "First-time occupancy after refurbishment".
      hints: { ...NO_HINTS, firstOccupancy: true },
    });
    expect(
      immoscout24.readListing(englishPage(), ENGLISH_URL)?.missing,
    ).toContain("priceComparison");
  });

  it("names features in German, so a letter stays German", () => {
    expect(
      immoscout24.readListing(englishPage(), ENGLISH_URL)?.features,
    ).toEqual(["Balkon", "Keller", "WG-geeignet"]);
  });

  it("leaves out a feature it has no German name for", () => {
    const page = englishPage();
    const tag = page.querySelector('[data-qa="is24qa-cellar-label"]');
    tag?.setAttribute("data-qa", "is24qa-sauna-label");
    expect(immoscout24.readListing(page, ENGLISH_URL)?.features).toEqual([
      "Balkon",
      "WG-geeignet",
    ]);
  });

  it.each([
    ["Yes", "allowed"],
    ["No", "not_allowed"],
    ["By arrangement", "by_arrangement"],
  ])("reads pets %s", (text, policy) => {
    const page = englishPage();
    const pets = page.querySelector(".is24qa-pets");
    if (pets) pets.textContent = text;
    expect(immoscout24.readListing(page, ENGLISH_URL)?.petPolicy).toBe(policy);
  });

  it.each([
    ["Ground floor", 0],
    ["Basement", -1],
    ["3 of 5", 3],
  ])("reads floor %s", (text, floor) => {
    const page = englishPage();
    const row = page.querySelector(".is24qa-floor");
    if (row) row.textContent = text;
    expect(immoscout24.readListing(page, ENGLISH_URL)?.floor).toBe(floor);
  });

  it("does not misread a German-written rent on the English page", () => {
    const page = englishPage();
    const rent = page.querySelector(".is24qa-total-rent");
    const main = page.querySelector(
      ".is24qa-maincriteria-rentincludingutilities-label-main",
    );
    if (rent) rent.textContent = "1.105 €";
    if (main) main.textContent = "1.105 €";
    const listing = immoscout24.readListing(page, ENGLISH_URL);
    expect(listing?.warmmieteCents).toBeUndefined();
    expect(listing?.missing).toContain("warmmieteCents");
  });
});

describe("immoscout24 contact form on the English page", () => {
  const LETTER = "Sehr geehrte Damen und Herren";
  const german = () =>
    immoscout24.readContactForm(
      loadFixture("immoscout24", "contact-form.html"),
    );
  const english = () =>
    immoscout24.readContactForm(
      loadFixture("immoscout24", "en-contact-form.html"),
    );

  it("finds the open dialog's form", () => {
    expect(english().map((f) => f.key)).toContain("name:firstName");
  });

  it.each([
    ["a couple with a dog", coupleWithDog],
    ["a solo student", soloStudent],
  ])("plans the same fill as the German form for %s", (_name, profile) => {
    const pairs = (fields: ReturnType<typeof german>) =>
      mapFields(fields, profile, LETTER).mappings.map((m) => [
        m.field.key,
        m.kind,
        m.value,
      ]);
    expect(pairs(english())).toEqual(pairs(german()));
  });

  it("matches as many fields as the German form", () => {
    const score = (fields: ReturnType<typeof german>) => {
      const { matched, total } = mapFields(fields, coupleWithDog, LETTER);
      return { matched, total };
    };
    expect(score(english())).toEqual(score(german()));
  });

  it("leaves both opt-ins alone", () => {
    const { leftAlone } = mapFields(english(), coupleWithDog, LETTER);
    expect(leftAlone.map((f) => f.key)).toEqual([
      "name:sendUserProfile",
      "id:is24-checkbox-isRelocationOfferChecked-input",
    ]);
  });
});
