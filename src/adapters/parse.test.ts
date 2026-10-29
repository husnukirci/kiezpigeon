import { describe, expect, it } from "vitest";
import {
  parseContactName,
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
