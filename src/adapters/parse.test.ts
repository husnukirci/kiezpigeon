import { describe, expect, it } from "vitest";
import {
  parseAvailability,
  parseContactName,
  parseEnglishAvailability,
  parseEnglishEuro,
  parseEnglishNumber,
  parseEuroText,
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
