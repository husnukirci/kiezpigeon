// Fixture tests (PLAN.md section 5): each saved, scrubbed page and the
// exact Listing the adapter returns for it.
import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../test-support/fixtures";
import { coupleWithDog } from "../../../test-support/sample-profiles";
import { mapFields } from "../../rules/fieldMatch";
import { immoscout24 } from "./immoscout24";

const URL = "https://www.immobilienscout24.de/expose/100000003";

describe("immoscout24.matches", () => {
  it("matches exposé pages only", () => {
    expect(immoscout24.matches(URL)).toBe(true);
    expect(immoscout24.matches(`${URL}?referrer=RESULT_LIST`)).toBe(true);
    expect(
      immoscout24.matches(
        "https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-mieten",
      ),
    ).toBe(false);
    expect(
      immoscout24.matches("https://www.example.org/expose/100000003"),
    ).toBe(false);
  });
});

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
      features: [],
      missing: [
        "floor",
        "availability",
        "yearBuilt",
        "petPolicy",
        "wbsRequired",
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
});
