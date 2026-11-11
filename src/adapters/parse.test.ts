import { describe, expect, it } from "vitest";
import {
  parseAvailability,
  parseContactName,
  parseDepositText,
  parseEnglishAvailability,
  parseEnglishEuro,
  parseEnglishNumber,
  parseEuroText,
  parseFloor,
  parseGermanDate,
  parseNumberText,
} from "./parse";

describe("parseEuroText", () => {
  it("reads German money as cents", () => {
    expect(parseEuroText("750 €")).toBe(75000);
    expect(parseEuroText("+ 200 €")).toBe(20000);
    expect(parseEuroText("1.180,50 €")).toBe(118050);
    expect(parseEuroText("1.400 € (zzgl. Heizkosten)")).toBe(140000);
  });

  it("returns undefined for text without a number", () => {
    expect(parseEuroText("in Nebenkosten enthalten")).toBeUndefined();
  });
});

describe("parseNumberText", () => {
  it("reads a decimal comma and thousands dots", () => {
    expect(parseNumberText("44 m²")).toBe(44);
    expect(parseNumberText("62,5 m²")).toBe(62.5);
    expect(parseNumberText("2,5")).toBe(2.5);
    expect(parseNumberText("1.020 m²")).toBe(1020);
    expect(parseNumberText("k. A.")).toBeUndefined();
  });
});

describe("parseGermanDate", () => {
  it("finds a date in the text and returns it as ISO", () => {
    expect(parseGermanDate("01.03.2027")).toBe("2027-03-01");
    expect(parseGermanDate("ab 1.3.2027")).toBe("2027-03-01");
    expect(parseGermanDate("sofort")).toBeUndefined();
  });
});

describe("parseContactName", () => {
  it("splits salutation, first name and surname, dropping titles", () => {
    expect(parseContactName("Frau Dr. Anna Weber")).toEqual({
      salutation: "Frau",
      firstName: "Anna",
      lastName: "Weber",
    });
    expect(parseContactName("Herr Weber")).toEqual({
      salutation: "Herr",
      lastName: "Weber",
    });
    expect(parseContactName(" Lena  Beispiel ")).toEqual({
      firstName: "Lena",
      lastName: "Beispiel",
    });
  });

  it("greets no company by name", () => {
    expect(parseContactName("Beispiel Wohnen GmbH")).toBeUndefined();
    expect(parseContactName("Kundenservice")).toBeUndefined();
    expect(parseContactName("")).toBeUndefined();
  });
});

describe("parseAvailability", () => {
  it.each([
    ["01.03.2027", { kind: "date", date: "2027-03-01" }],
    ["ab 1.3.2027", { kind: "date", date: "2027-03-01" }],
    ["sofort", { kind: "immediately" }],
    ["ab sofort", { kind: "immediately" }],
    ["Sofort", { kind: "immediately" }],
    ["nach Vereinbarung", { kind: "by_arrangement" }],
    ["nach Absprache", { kind: "by_arrangement" }],
    ["bald", undefined],
  ])("reads %j", (text, expected) => {
    expect(parseAvailability(text)).toEqual(expected);
  });
});

describe("the English page's text", () => {
  it("reads euros with a comma for thousands and a point for cents", () => {
    expect(parseEnglishEuro("€865")).toBe(86500);
    expect(parseEnglishEuro("+ €240")).toBe(24000);
    expect(parseEnglishEuro("€1,105")).toBe(110500);
    expect(parseEnglishEuro("€1,180.50")).toBe(118050);
  });

  it("refuses a sum written the German way rather than misread it", () => {
    expect(parseEnglishEuro("1.105 €")).toBeUndefined();
    expect(parseEnglishEuro("2.595,00 €")).toBeUndefined();
    expect(parseEnglishEuro("no price")).toBeUndefined();
  });

  it("reads sizes and rooms with a decimal point", () => {
    expect(parseEnglishNumber("60.13 m²")).toBe(60.13);
    expect(parseEnglishNumber("2")).toBe(2);
    expect(parseEnglishNumber("2.5")).toBe(2.5);
    expect(parseEnglishNumber("1,204 m²")).toBe(1204);
    expect(parseEnglishNumber("60,13 m²")).toBeUndefined();
  });

  it("reads when the flat is free", () => {
    expect(parseEnglishAvailability("01.11.2025")).toEqual({
      kind: "date",
      date: "2025-11-01",
    });
    expect(parseEnglishAvailability("immediately")).toEqual({
      kind: "immediately",
    });
    expect(parseEnglishAvailability("by arrangement")).toEqual({
      kind: "by_arrangement",
    });
    expect(parseEnglishAvailability("soon")).toBeUndefined();
  });
});

describe("parseFloor", () => {
  it.each<[string, number]>([
    ["EG", 0],
    ["Erdgeschoss", 0],
    ["Erdgeschoß", 0],
    ["Ground floor", 0],
    ["UG", -1],
    ["Untergeschoß", -1],
    ["1. Untergeschoss", -1],
    ["Souterrain", -1],
    ["Basement", -1],
    ["2. Obergeschoß", 2],
    ["3. OG", 3],
    ["1 von 5", 1],
    ["3 of 5", 3],
    ["4", 4],
  ])("reads %s as %d", (text, floor) => {
    expect(parseFloor(text)).toBe(floor);
  });
  it("returns undefined for other text", () => {
    expect(parseFloor("Hochparterre")).toBeUndefined();
  });
});

describe("parseDepositText", () => {
  it("reads an amount as cents", () => {
    expect(parseDepositText("3.540 €", 118000)).toBe(354000);
    expect(parseDepositText("1000", 118000)).toBe(100000);
  });
  it.each([
    "3 Nettokaltmieten",
    "3 Kaltmieten",
    "3 Monatsmieten",
    "3 MM",
    "3 NKM",
    "3 monthly rents",
  ])("reads %s as three rents", (text) => {
    expect(parseDepositText(text, 118000)).toBe(354000);
    expect(parseDepositText(text, undefined)).toBeUndefined();
  });
  it.each([
    "3 Nettokaltmieten (3.540 €)",
    "3 MM (3.540 €)",
    "3 Kaltmieten (3.540 €)",
    "3 Nettokaltmieten, max. 3.540 EUR",
    "3.540,00 EUR",
  ])("takes the larger of the count and the stated amount: %s", (text) => {
    expect(parseDepositText(text, 118000)).toBe(354000);
  });
  it("reads an amount followed by a count", () => {
    expect(parseDepositText("1.180 € x 3", 118000)).toBe(354000);
  });
  it.each(["3 x Kaltmiete", "3 × Kaltmiete"])("reads %s", (text) => {
    expect(parseDepositText(text, 118000)).toBe(354000);
    expect(parseDepositText(text, undefined)).toBeUndefined();
  });
  it("reads Monatskaltmieten", () => {
    expect(parseDepositText("2 Monatskaltmieten", 118000)).toBe(236000);
  });
  it("never reads a number word as euros", () => {
    expect(parseDepositText("drei Monatsmieten", 118000)).toBeUndefined();
  });
  it("reads a half rent", () => {
    expect(parseDepositText("2,5 Kaltmieten", 100000)).toBe(250000);
  });
});

describe("parseContactName companies", () => {
  it.each([
    "Wohnungsbaugenossenschaft Muster e.G.",
    "Musterhausverwaltung",
    "Vermietungsteam Berlin",
    "Muster Immobilien GmbH",
    "Muster Wohnen Service",
  ])("greets no company by name: %s", (name) => {
    expect(parseContactName(name)).toBeUndefined();
  });

  it("does not take a short surname for a legal form", () => {
    expect(parseContactName("Frau Se")).toEqual({
      salutation: "Frau",
      lastName: "Se",
    });
    expect(parseContactName("Herr Ag")).toEqual({
      salutation: "Herr",
      lastName: "Ag",
    });
  });
});

describe("parseContactName legal forms in any case", () => {
  it.each(["MUSTER BAU GMBH", "Muster Gmbh", "Muster Ohg", "Muster Bau Ag"])(
    "greets no company by name: %s",
    (name) => {
      expect(parseContactName(name)).toBeUndefined();
    },
  );
});

describe("parseDepositText in more wordings", () => {
  it.each(["2.5 monthly rents", "2.5 Kaltmieten"])(
    "reads a point decimal count: %s",
    (text) => {
      expect(parseDepositText(text, 118000)).toBe(295000);
    },
  );

  it.each([
    "3-fache Kaltmiete",
    "3fache Nettokaltmiete",
    "3 Netto-Kaltmieten",
    "3 Monatsnettokaltmieten",
    "3 KM",
    "3 Mieten",
    "3 Nettomieten",
    "3 months' rent",
  ])("reads %s as three rents", (text) => {
    expect(parseDepositText(text, 118000)).toBe(354000);
  });

  it.each([
    "3 Kaltmieten à 1.180 €",
    "3 NKM zzgl. 100 € Schlüsselpfand",
    "3 Kaltmieten (3.540 €)",
  ])("takes the larger of count and amount: %s", (text) => {
    expect(parseDepositText(text, 118000)).toBe(354000);
  });

  it("uses the stated amount alone when the Kaltmiete is not known", () => {
    expect(parseDepositText("3 Kaltmieten (3.540 €)", undefined)).toBe(354000);
  });

  it("never reads a small count of an unknown word as euros", () => {
    expect(parseDepositText("3 Monatsbeträge", 118000)).toBeUndefined();
    expect(parseDepositText("1000", 118000)).toBe(100000);
    expect(parseDepositText("1.500 Euro", 118000)).toBe(150000);
    expect(parseDepositText("3.540 €", 118000)).toBe(354000);
    expect(parseDepositText("drei Monatsmieten", 118000)).toBeUndefined();
  });
});
