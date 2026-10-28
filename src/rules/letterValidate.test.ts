import { describe, expect, it } from "vitest";
import { passingLetter } from "../../test-support/sample-letters";
import {
  coupleWithDog,
  kreuzbergListing,
} from "../../test-support/sample-profiles";
import { createLetterRequest } from "./letterPrompt";
import { countWords, validateLetter } from "./letterValidate";
import type { LetterRequest, Profile } from "./types";

const request: LetterRequest = createLetterRequest(
  coupleWithDog,
  kreuzbergListing,
  { tone: "warm", features: ["Balkon", "Altbau"] },
);

const noPetsProfile: Profile = {
  ...coupleWithDog,
  household: { ...coupleWithDog.household, pets: [] },
};
const noPetsRequest: LetterRequest = {
  ...request,
  household: noPetsProfile.household,
};

function replaced(from: string, to: string, letter = passingLetter): string {
  if (!letter.includes(from)) throw new Error(`fixture lacks "${from}"`);
  return letter.replace(from, to);
}

const filler =
  " Wir sind ruhige Nachbarn, pflegen die Wohnung sorgfältig und freuen uns auf ein langes, gutes Mietverhältnis mit Ihnen.";

describe("countWords", () => {
  it("counts runs of non-whitespace that hold a letter or digit", () => {
    expect(countWords("Sehr geehrte Frau Weber,")).toBe(4);
    expect(countWords("ab 01.03.2027 , und - auch € 2-Zimmer")).toBe(5);
    expect(countWords("  \n\t ")).toBe(0);
  });
});

describe("validateLetter", () => {
  it("accepts the 150-word fixture letter", () => {
    expect(countWords(passingLetter)).toBe(150);
    expect(validateLetter(passingLetter, request)).toEqual([]);
  });

  it("flags a letter under 120 words", () => {
    const short = [
      "Sehr geehrte Frau Weber,",
      "wir mögen den Balkon und den Altbau, unser Hund auch.",
      "Mara Testmann",
    ].join("\n\n");
    expect(validateLetter(short, request)).toEqual([
      { code: "too_short", text: "16 words" },
    ]);
  });

  it("accepts exactly 120 and 180 words", () => {
    const words = (n: number) =>
      Array.from({ length: n }, () => "wort").join(" ");
    const letter = (n: number) =>
      `Sehr geehrte Frau Weber,\nBalkon Altbau Hund ${words(n - 7)}`;
    expect(countWords(letter(120))).toBe(120);
    expect(validateLetter(letter(120), request)).toEqual([]);
    expect(validateLetter(letter(180), request)).toEqual([]);
    expect(validateLetter(letter(119), request)).toEqual([
      { code: "too_short", text: "119 words" },
    ]);
  });

  it("flags a letter over 180 words", () => {
    const long = replaced(
      "gern erreichbar.",
      `gern erreichbar.${filler}${filler}`,
    );
    expect(validateLetter(long, request)).toEqual([
      { code: "too_long", text: "186 words" },
    ]);
  });

  it("flags an em dash anywhere and a spaced en dash", () => {
    const emDash = String.fromCodePoint(0x2014);
    const enDash = String.fromCodePoint(0x2013);
    const letter = replaced(
      "gelesen. Mein",
      `gelesen ${emDash} mein`,
      replaced("vollständig vor.", `vollständig${emDash}vor.`),
    ).replace("Lehrer. Zusammen", `Lehrer ${enDash} zusammen`);
    expect(validateLetter(letter, request)).toEqual([
      { code: "em_dash", text: `gelesen ${emDash} mein` },
      { code: "em_dash", text: `Lehrer ${enDash} zusammen` },
      { code: "em_dash", text: `vollständig${emDash}vor.` },
    ]);
  });

  it("allows an en dash between two digits", () => {
    const enDash = String.fromCodePoint(0x2013);
    const letter = replaced("die 2-Zimmer-Wohnung", `die 1${enDash}2 Zimmer`);
    expect(validateLetter(letter, request)).toEqual([]);
  });

  it("flags a number that is not in the facts, once per spelling", () => {
    const letter = replaced("4.600 €", "4.800 €").replace(
      "Lehrer.",
      "Lehrer seit 2019, mit 4.800 € Erfahrung.",
    );
    expect(validateLetter(letter, request)).toEqual([
      { code: "unknown_number", text: "2019" },
      { code: "unknown_number", text: "4.800" },
    ]);
  });

  it("reads German money, decimals and dates as the facts' numbers", () => {
    const letter = replaced(
      "Kaltmiete von 1.180 €.",
      "Kaltmiete von 1.180,00 € und Warmmiete von 1.400 € für 62 m² im 3. Stock, frei ab 1.3.2027, Baujahr 1905, Verhältnis 3,8.",
    );
    expect(validateLetter(letter, request)).toEqual([]);
  });

  it("accepts contact form values such as the phone number", () => {
    const letter = replaced(
      "gern erreichbar.",
      "gern erreichbar, Telefon 030 5550123.",
    );
    expect(validateLetter(letter, request)).toEqual([]);
  });

  it("does not check number words", () => {
    const letter = replaced(
      "die 2-Zimmer-Wohnung",
      "die Wohnung mit zwölf Zimmern",
    );
    expect(validateLetter(letter, request)).toEqual([]);
  });

  it("flags a first line without the contact person's surname", () => {
    const letter = replaced(
      "Sehr geehrte Frau Weber,",
      "Sehr geehrte Damen und Herren,",
    );
    expect(validateLetter(letter, request)).toEqual([
      { code: "wrong_salutation", text: "Sehr geehrte Damen und Herren," },
    ]);
  });

  it("needs the general salutation when no contact person is known", () => {
    const anonymousRequest = {
      ...request,
      listing: { ...kreuzbergListing, contactPerson: undefined },
    };
    expect(validateLetter(passingLetter, anonymousRequest)).toEqual([
      { code: "wrong_salutation", text: "Sehr geehrte Frau Weber," },
    ]);
    const general = replaced(
      "Sehr geehrte Frau Weber,",
      "Sehr geehrte Damen und Herren,",
    );
    expect(validateLetter(general, anonymousRequest)).toEqual([]);
  });

  it("treats a blank surname as no contact person", () => {
    const blankRequest = {
      ...request,
      listing: { ...kreuzbergListing, contactPerson: { lastName: "" } },
    };
    expect(validateLetter(passingLetter, blankRequest)).toEqual([
      { code: "wrong_salutation", text: "Sehr geehrte Frau Weber," },
    ]);
  });

  it("flags a pet the household has that the letter leaves out", () => {
    const letter = replaced("unser ruhiger Hund", "unser ruhiger Begleiter");
    expect(validateLetter(letter, request)).toEqual([
      { code: "pets_missing", text: "Hund" },
    ]);
  });

  it("does not count a denied pet as mentioned", () => {
    const letter = replaced(
      "dass unser ruhiger Hund mit einziehen würde.",
      "dass wir keinen Hund mitbringen würden.",
    );
    expect(validateLetter(letter, request)).toEqual([
      { code: "pets_missing", text: "Hund" },
    ]);
  });

  it("accepts the general word Haustier for any pet", () => {
    const letter = replaced("unser ruhiger Hund", "unser ruhiges Haustier");
    expect(validateLetter(letter, request)).toEqual([]);
  });

  it("flags a pet word when the household has no pets", () => {
    expect(validateLetter(passingLetter, noPetsRequest)).toEqual([
      { code: "pets_invented", text: "Hund" },
    ]);
  });

  it("lets a pet-free household say it has no pets", () => {
    const letter = replaced(
      "dass unser ruhiger Hund mit einziehen würde.",
      "dass wir ein Nichtraucherhaushalt ohne Haustiere sind.",
    );
    expect(validateLetter(letter, noPetsRequest)).toEqual([]);
  });

  it("does not read Hundert as a dog", () => {
    const letter = replaced(
      "Ein Einzug",
      "Unter Hunderten Anzeigen hat uns Ihre gefallen. Ein Einzug",
    );
    expect(validateLetter(letter, noPetsRequest)).toEqual([
      { code: "pets_invented", text: "Hund" },
    ]);
  });

  it("flags a chosen feature the letter leaves out", () => {
    const letter = replaced("über den Balkon", "über den Garten");
    expect(validateLetter(letter, request)).toEqual([
      { code: "feature_missing", text: "Balkon" },
    ]);
  });

  it("finds a feature inside a longer word, ignoring case", () => {
    const altbauOnly = { ...request, features: ["altbau"] };
    expect(validateLetter(passingLetter, altbauOnly)).toEqual([]);
  });

  it("rejects a request with no feature or more than two", () => {
    expect(() =>
      validateLetter(passingLetter, { ...request, features: [] }),
    ).toThrow(RangeError);
    expect(() =>
      validateLetter(passingLetter, {
        ...request,
        features: ["Balkon", "Altbau", "Garten"],
      }),
    ).toThrow(RangeError);
  });

  it("lists problems in code order", () => {
    const emDash = String.fromCodePoint(0x2014);
    const letter = ["Liebe Leute,", `wir zahlen 999 € ${emDash} sofort.`].join(
      "\n",
    );
    expect(validateLetter(letter, request).map((p) => p.code)).toEqual([
      "too_short",
      "em_dash",
      "unknown_number",
      "wrong_salutation",
      "pets_missing",
      "feature_missing",
      "feature_missing",
    ]);
  });
});
