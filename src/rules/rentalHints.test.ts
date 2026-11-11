import { describe, expect, it } from "vitest";
import { NO_HINTS, rentalHints } from "./rentalHints";
import type { RentalHints } from "./types";

const only = (flag: keyof RentalHints): RentalHints => ({
  ...NO_HINTS,
  [flag]: true,
});

describe("rentalHints", () => {
  it("sees a sublet", () => {
    expect(rentalHints("Zur Untermiete für 6 Monate")).toEqual(only("sublet"));
    expect(rentalHints("Room to sublet in Wedding")).toEqual(only("sublet"));
  });

  it("sees an interim let and a fixed term", () => {
    expect(rentalHints("Zwischenmiete, befristet bis März")).toEqual({
      ...NO_HINTS,
      interim: true,
      fixedTerm: true,
    });
  });

  it("sees furnished, not unfurnished", () => {
    expect(rentalHints("Teilmöbliert 2 Zimmer")).toEqual(only("furnished"));
    expect(rentalHints("nicht möbliert").furnished).toBe(false);
    expect(rentalHints("unfurnished").furnished).toBe(false);
  });

  it("sees a WG room, not a flat that is WG-geeignet", () => {
    expect(rentalHints("WG-Zimmer in Neukölln")).toEqual(only("sharedFlat"));
    expect(rentalHints("WG-geeignet").sharedFlat).toBe(false);
    // The English page's tag for the same feature.
    expect(rentalHints("Suitable for shared flats").sharedFlat).toBe(false);
  });

  it("sees a Genossenschaft, not the Kosten row's label", () => {
    expect(rentalHints("Wohnen bei der Genossenschaft")).toEqual(
      only("cooperative"),
    );
    expect(rentalHints("Kaution o. Genossenschaftsanteile").cooperative).toBe(
      false,
    );
  });

  it("sees WBS required only when the text says so, and a mention apart", () => {
    const required = { ...NO_HINTS, wbs: true, wbsMentioned: true };
    expect(rentalHints("Wohnberechtigungsschein erforderlich")).toEqual(
      required,
    );
    expect(rentalHints("Nur mit WBS")).toEqual(required);
    expect(rentalHints("A WBS is required for this flat")).toEqual(required);
    // A real listing: rented only to households without a WBS entitlement.
    expect(
      rentalHints(
        "Die Wohnung wird ausschließlich an einen 1-2 Personen-Haushalt ohne WBS-Anspruch vermietet. Ob Sie WBS-berechtigt sind, können Sie auf der Webseite prüfen.",
      ),
    ).toEqual(only("wbsMentioned"));
    expect(rentalHints("WBS erwünscht")).toEqual(only("wbsMentioned"));
  });

  it("sees Erstbezug, Staffelmiete and Indexmiete", () => {
    expect(rentalHints("Erstbezug nach Sanierung")).toEqual(
      only("firstOccupancy"),
    );
    // The English fixture's condition row.
    expect(rentalHints("First-time occupancy after refurbishment")).toEqual(
      only("firstOccupancy"),
    );
    expect(rentalHints("Staffelmiete")).toEqual(only("staffel"));
    expect(rentalHints("Indexmiete")).toEqual(only("index"));
  });

  it("sees a Provision asked, not one ruled out", () => {
    expect(rentalHints("Provision: 2 Monatsmieten")).toEqual(
      only("commission"),
    );
    expect(
      rentalHints(
        "Hinweis zu Ihrem Schutz: Wir vermieten provisionsfrei gemäß § 2 WoVermG. Personen, die im Auftrag tätig sind, dürfen keine Provision von Ihnen verlangen.",
      ).commission,
    ).toBe(false);
    expect(rentalHints("commission-free").commission).toBe(false);
  });

  it("sees no viewing, payment first and a landlord abroad", () => {
    expect(rentalHints("Eine Besichtigung ist nicht möglich")).toEqual(
      only("noViewing"),
    );
    expect(rentalHints("Kaution bitte vorab überweisen")).toEqual(
      only("paymentFirst"),
    );
    expect(rentalHints("payment via Western Union")).toEqual(
      only("paymentFirst"),
    );
    expect(rentalHints("Ich bin derzeit im Ausland")).toEqual(only("abroad"));
    expect(rentalHints("I am currently abroad")).toEqual(only("abroad"));
  });

  it("does not take a thing ruled out for a thing named", () => {
    // A WBS ruled out is still a WBS mentioned.
    for (const text of ["Kein WBS erforderlich", "WBS nicht erforderlich"]) {
      expect(rentalHints(text), text).toEqual(only("wbsMentioned"));
    }
    const quiet = [
      "Unbefristeter Mietvertrag",
      "Der Mietvertrag ist unbefristet",
      "Untervermietung ist nicht gestattet",
      "Keine Untervermietung",
      "Nicht für Wohngemeinschaften geeignet",
      "The flat is not furnished",
      "Keine Indexmiete, keine Staffelmiete",
      "Kein Erstbezug",
      "security deposit or cooperative shares",
    ];
    for (const text of quiet) expect(rentalHints(text), text).toEqual(NO_HINTS);
    expect(rentalHints("a housing cooperative")).toEqual(only("cooperative"));
  });

  it("asks for a payment first only when a payment is named with the timing", () => {
    expect(
      rentalHints("Bitte überweisen Sie die Kaution vor der Besichtigung"),
    ).toEqual(only("paymentFirst"));
    expect(rentalHints("The deposit must be paid before the viewing")).toEqual(
      only("paymentFirst"),
    );
    const quiet = [
      "Please bring your documents before the viewing",
      "Mietzahlung per PayPal nicht möglich",
      "Die Wohnung ist kein Airbnb",
      "Keine Anzahlung nötig",
    ];
    for (const text of quiet) expect(rentalHints(text), text).toEqual(NO_HINTS);
  });

  it("sees the landlord abroad, not applicants from abroad", () => {
    expect(rentalHints("Der Vermieter lebt im Ausland")).toEqual(
      only("abroad"),
    );
    expect(rentalHints("The owner is currently out of the country")).toEqual(
      only("abroad"),
    );
    const quiet = [
      "Applicants from abroad are welcome",
      "Bewerbungen aus dem Ausland sind willkommen",
    ];
    for (const text of quiet) expect(rentalHints(text), text).toEqual(NO_HINTS);
  });

  it("sees no viewing, not a plea against viewing requests", () => {
    expect(
      rentalHints("Bitte keine Besichtigungsanfragen per Telefon"),
    ).toEqual(NO_HINTS);
    expect(rentalHints("Keine Besichtigung möglich")).toEqual(
      only("noViewing"),
    );
  });

  it("is all false for plain text", () => {
    expect(
      rentalHints(
        "Helle Wohnung mit Balkon und Holzdielen, ruhig zum Hof gelegen.",
      ),
    ).toEqual(NO_HINTS);
  });
});
