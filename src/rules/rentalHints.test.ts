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

  it("sees WBS, Erstbezug, Staffelmiete and Indexmiete", () => {
    expect(rentalHints("Wohnberechtigungsschein erforderlich")).toEqual(
      only("wbs"),
    );
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

  it("is all false for plain text", () => {
    expect(
      rentalHints(
        "Helle Wohnung mit Balkon und Holzdielen, ruhig zum Hof gelegen.",
      ),
    ).toEqual(NO_HINTS);
  });
});
