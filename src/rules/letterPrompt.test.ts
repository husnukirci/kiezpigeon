import { describe, expect, it } from "vitest";
import {
  coupleWithDog,
  kreuzbergListing,
  soloStudent,
  sparseListing,
} from "../../test-support/sample-profiles";
import {
  buildLetterPrompt,
  createLetterRequest,
  salutationFor,
} from "./letterPrompt";
import type { LetterRequest } from "./types";

const strong: LetterRequest = createLetterRequest(
  coupleWithDog,
  kreuzbergListing,
  { tone: "warm", features: ["Balkon", "Altbau"] },
);

describe("createLetterRequest", () => {
  it("carries the letter facts and leaves out budget and WBS flag", () => {
    expect(Object.keys(strong).sort()).toEqual([
      "allDocumentsReady",
      "applicants",
      "contact",
      "features",
      "household",
      "listing",
      "moveInDate",
      "tone",
    ]);
  });

  it("counts documents as all ready without a WBS when you have none", () => {
    expect(strong.allDocumentsReady).toBe(true);
  });

  it("needs the WBS document ready when you have a WBS", () => {
    const withWbs = { ...coupleWithDog, hasWbs: true };
    const request = createLetterRequest(withWbs, kreuzbergListing, {
      tone: "warm",
      features: ["Balkon"],
    });
    expect(request.allDocumentsReady).toBe(false);
  });
});

describe("salutationFor", () => {
  it("addresses the contact person by name when known", () => {
    expect(salutationFor({ salutation: "Frau", lastName: "Weber" })).toBe(
      "Sehr geehrte Frau Weber,",
    );
    expect(salutationFor({ salutation: "Herr", lastName: "Krause" })).toBe(
      "Sehr geehrter Herr Krause,",
    );
    expect(salutationFor({ firstName: "Kim", lastName: "Park" })).toBe(
      "Guten Tag Kim Park,",
    );
  });

  it("falls back to the general salutation", () => {
    expect(salutationFor(undefined)).toBe("Sehr geehrte Damen und Herren,");
  });

  it("falls back to the general salutation for a blank surname", () => {
    expect(salutationFor({ salutation: "Frau", lastName: "  " })).toBe(
      "Sehr geehrte Damen und Herren,",
    );
  });
});

describe("buildLetterPrompt", () => {
  it("lists the facts, strongest signals first", () => {
    expect(buildLetterPrompt(strong).user).toBe(
      [
        "Anrede: Sehr geehrte Frau Weber,",
        "",
        "Bewerber:",
        "- Mara Testmann, Softwareentwicklerin, unbefristete Festanstellung, 2.600 € netto im Monat",
        "- Jonas Beispiel, Lehrer, verbeamtet, 2.000 € netto im Monat",
        "Haushaltsnettoeinkommen: 4.600 € im Monat",
        "Haushalt: 2 Erwachsene, keine Kinder, Nichtraucher",
        "Haustiere: 1 Hund",
        "Unterlagen: alle vollständig",
        "Gewünschter Einzug: 01.03.2027",
        "",
        "Wohnung:",
        "- Bezirk: Kreuzberg",
        "- Kaltmiete: 1.180 €",
        "- Nebenkosten: 220 €",
        "- Warmmiete: 1.400 €",
        "- Größe: 62 m²",
        "- Zimmer: 2",
        "- Etage: 3",
        "- Frei ab: 01.03.2027",
        "- Baujahr: 1905",
        "- Haustiere: nach Absprache",
        "",
        "Ausgewählte Merkmale: Balkon, Altbau",
        "",
        "Stärkste Signale, in dieser Reihenfolge:",
        "1. Sichere Anstellung (unbefristete Festanstellung oder verbeamtet)",
        "2. Einkommen 3,8 × Kaltmiete",
        "3. Alle Unterlagen liegen vollständig vor",
        "4. Einzug zum 01.03.2027, passend zum Bezugstermin",
      ].join("\n"),
    );
  });

  it("leaves out what the request does not know, and never the budget", () => {
    const request = createLetterRequest(soloStudent, sparseListing, {
      tone: "short",
      features: ["Balkon"],
    });
    const { system, user } = buildLetterPrompt(request);
    expect(user).toBe(
      [
        "Anrede: Sehr geehrte Damen und Herren,",
        "",
        "Bewerber:",
        "- Pia Musterfrau, Studentin, im Studium, 950 € netto im Monat",
        "Haushaltsnettoeinkommen: 950 € im Monat",
        "Haushalt: 1 erwachsene Person, keine Kinder, Nichtraucher",
        "Haustiere: keine",
        "",
        "Ausgewählte Merkmale: Balkon",
        "",
        "Stärkste Signale, in dieser Reihenfolge:",
        "1. Nichtraucherhaushalt ohne Haustiere",
      ].join("\n"),
    );
    expect(system + user).not.toContain("undefined");
    expect(buildLetterPrompt(strong).user).not.toContain("1.300");
    expect(user).not.toContain("WBS");
  });

  it("keeps contact details out of the prompt", () => {
    const { system, user } = buildLetterPrompt(strong);
    const { email, phone, street, postcode } = coupleWithDog.contact;
    for (const value of [email, phone, street, postcode]) {
      expect(system + user).not.toContain(value);
    }
  });

  it("states language, tone, length, salutation and the dash rule", () => {
    const { system } = buildLetterPrompt(strong);
    expect(system).toContain("Write in German");
    expect(system).toContain("Tone: warm and personal");
    expect(system).toContain("120 to 180 words");
    expect(system).toContain(
      "Begin with exactly this line: Sehr geehrte Frau Weber,",
    );
    expect(system).toContain("U+2014");
    expect(system).not.toContain(String.fromCodePoint(0x2014));
    expect(system).toContain("Open with the strongest signals");
    expect(system).toContain("Use only the facts given");
  });

  it("names a different instruction per tone", () => {
    const tones = (["warm", "formal", "short"] as const).map(
      (tone) => buildLetterPrompt({ ...strong, tone }).system,
    );
    expect(new Set(tones).size).toBe(3);
    expect(tones[1]).toContain("Tone: formal");
    expect(tones[2]).toContain("Tone: short");
  });

  it("asks for the chosen features by name", () => {
    expect(buildLetterPrompt(strong).system).toContain(
      "Mention these features of the flat by name: Balkon, Altbau.",
    );
  });

  it("asks for an honest pets sentence only when there are pets", () => {
    expect(buildLetterPrompt(strong).system).toContain(
      "Mention the pets honestly in one sentence: 1 Hund.",
    );
    const solo = createLetterRequest(soloStudent, kreuzbergListing, {
      tone: "warm",
      features: ["Balkon"],
    });
    expect(buildLetterPrompt(solo).system).not.toContain("Mention the pets");
  });

  it("rejects a request with no feature or more than two", () => {
    expect(() => buildLetterPrompt({ ...strong, features: [] })).toThrow(
      RangeError,
    );
    expect(() =>
      buildLetterPrompt({
        ...strong,
        features: ["Balkon", "Altbau", "Garten"],
      }),
    ).toThrow(RangeError);
  });

  it("writes without features when the listing names none", () => {
    const bare = createLetterRequest(coupleWithDog, sparseListing, {
      tone: "warm",
      features: [],
    });
    const { system, user } = buildLetterPrompt(bare);
    expect(system).not.toContain("Mention these features");
    expect(user).not.toContain("Ausgewählte Merkmale");
  });
});
