import { describe, expect, it } from "vitest";
import { coupleWithDog, soloStudent } from "../../test-support/sample-profiles";
import { classifyField, mapFields } from "./fieldMatch";
import { defaultProfile } from "./profile";
import type { FieldKind, FormField } from "./types";

let nextKey = 0;
function field(partial: Partial<FormField>): FormField {
  nextKey += 1;
  return {
    key: `f${nextKey}`,
    type: "text",
    visible: true,
    disabled: false,
    ...partial,
  };
}

describe("classifyField", () => {
  it("trusts the autocomplete attribute first", () => {
    const cases: [string, FieldKind][] = [
      ["given-name", "firstName"],
      ["family-name", "lastName"],
      ["email", "email"],
      ["tel", "phone"],
      ["street-address", "street"],
      ["postal-code", "postcode"],
      ["address-level2", "city"],
      ["honorific-prefix", "salutation"],
    ];
    for (const [autocomplete, kind] of cases) {
      expect(classifyField(field({ autocomplete, name: "x" }))).toBe(kind);
    }
  });

  it.each<[Partial<FormField>, FieldKind]>([
    [{ label: "Anrede", type: "select" }, "salutation"],
    [{ name: "firstName" }, "firstName"],
    [{ label: "Vorname" }, "firstName"],
    [{ id: "contactForm-lastname" }, "lastName"],
    [{ label: "Nachname" }, "lastName"],
    [{ label: "E-Mail-Adresse" }, "email"],
    [{ placeholder: "Ihre Telefonnummer" }, "phone"],
    [{ label: "Straße" }, "street"],
    [{ label: "Hausnummer" }, "houseNumber"],
    [{ name: "houseNumber" }, "houseNumber"],
    [{ label: "PLZ" }, "postcode"],
    [{ name: "zipCode" }, "postcode"],
    [{ label: "Ort" }, "city"],
    [{ label: "Wohnort" }, "city"],
    [{ label: "Ihre Nachricht", type: "textarea" }, "message"],
    [{ label: "Anzahl Erwachsene" }, "adults"],
    [{ label: "Anzahl Kinder" }, "children"],
    [{ label: "Haustiere", type: "checkbox" }, "pets"],
    [{ label: "Nichtraucher", type: "checkbox" }, "smoker"],
    [{ label: "Haushaltsnettoeinkommen" }, "income"],
    [{ name: "income" }, "income"],
    [{ label: "Beruf" }, "employment"],
    [{ label: "Beschäftigungsverhältnis", type: "select" }, "employment"],
    [{ label: "Einzugstermin" }, "moveInDate"],
    [{ name: "moveInDate", type: "date" }, "moveInDate"],
    [{ label: "WBS vorhanden", type: "checkbox" }, "wbs"],
    [
      { label: "Ich akzeptiere die Datenschutzerklärung", type: "checkbox" },
      "consent",
    ],
    [{ name: "privacyPolicyAccepted", type: "checkbox" }, "consent"],
    [{ label: "Newsletter abonnieren", type: "checkbox" }, "consent"],
    [{ label: "Lieblingsfarbe" }, "unknown"],
  ])("classifies %o as %s", (partial, kind) => {
    expect(classifyField(field(partial))).toBe(kind);
  });

  it("falls back on the input type", () => {
    expect(classifyField(field({ type: "email", name: "x1" }))).toBe("email");
    expect(classifyField(field({ type: "tel", name: "x2" }))).toBe("phone");
    expect(classifyField(field({ type: "textarea", name: "x3" }))).toBe(
      "message",
    );
  });

  it("does not read 'ort' inside other words", () => {
    expect(classifyField(field({ label: "Sortierung" }))).toBe("unknown");
    expect(classifyField(field({ name: "port" }))).toBe("unknown");
  });

  it("reads a combined street and number field as street", () => {
    expect(classifyField(field({ label: "Straße und Hausnummer" }))).toBe(
      "street",
    );
  });
});

describe("mapFields", () => {
  const letter = "Sehr geehrte Frau Weber, ...";

  it("maps profile values and the letter, and scores X of Y", () => {
    const fields = [
      field({ label: "Anrede", type: "select" }),
      field({ label: "Vorname" }),
      field({ label: "Nachname" }),
      field({ label: "E-Mail", type: "email" }),
      field({ label: "Telefon", type: "tel" }),
      field({ label: "Nachricht", type: "textarea" }),
      field({ label: "Anzahl Erwachsene", type: "number" }),
      field({ label: "Haustiere", type: "checkbox" }),
      field({ label: "Einzugstermin", type: "date" }),
      field({ label: "Datenschutz akzeptiert", type: "checkbox" }),
      field({ label: "Lieblingsfarbe" }),
    ];
    const result = mapFields(fields, coupleWithDog, letter);
    expect(result.total).toBe(11);
    expect(result.matched).toBe(8);
    expect(result.mappings.map((m) => [m.kind, m.value])).toEqual([
      ["salutation", undefined],
      ["firstName", "Mara"],
      ["lastName", "Testmann"],
      ["email", "mara.testmann@example.org"],
      ["phone", "030 5550123"],
      ["message", letter],
      ["adults", 2],
      ["pets", true],
      ["moveInDate", "2027-03-01"],
      ["consent", undefined],
      ["unknown", undefined],
    ]);
  });

  it("never gives a consent checkbox a value", () => {
    const consent = field({ label: "Ich willige ein", type: "checkbox" });
    const result = mapFields([consent], coupleWithDog, letter);
    expect(result.mappings).toEqual([
      { field: consent, kind: "consent", value: undefined },
    ]);
    expect(result.matched).toBe(0);
    expect(result.total).toBe(1);
  });

  it("leaves out hidden, disabled, button-like, file, password and captcha fields", () => {
    const counted = field({ label: "Vorname" });
    const fields = [
      counted,
      field({ label: "Nachname", visible: false }),
      field({ label: "E-Mail", disabled: true }),
      field({ name: "token", type: "hidden" }),
      field({ name: "send", type: "submit" }),
      field({ name: "go", type: "button" }),
      field({ name: "attachment", type: "file" }),
      field({ name: "pw", type: "password" }),
      field({ name: "g-recaptcha-response" }),
      field({ label: "Captcha" }),
    ];
    const result = mapFields(fields, coupleWithDog, letter);
    expect(result.mappings.map((m) => m.field)).toEqual([counted]);
    expect(result).toMatchObject({ matched: 1, total: 1 });
  });

  it("maps household, income, employment and WBS as plain values", () => {
    const fields = [
      field({ label: "Kinder", type: "number" }),
      field({ label: "Raucher", type: "checkbox" }),
      field({ label: "Nettoeinkommen" }),
      field({ label: "Beruf" }),
      field({ label: "WBS", type: "checkbox" }),
      field({ label: "Straße" }),
      field({ label: "Hausnummer" }),
      field({ label: "PLZ" }),
      field({ label: "Ort" }),
    ];
    expect(
      mapFields(fields, coupleWithDog, letter).mappings.map((m) => m.value),
    ).toEqual([
      0,
      false,
      460000,
      "permanent",
      false,
      "Erfundene Straße",
      "7",
      "10999",
      "Berlin",
    ]);
  });

  it("inverts the value for a non-smoker field", () => {
    const fields = [
      field({ label: "Nichtraucher", type: "checkbox" }),
      field({ name: "nonSmoker", type: "checkbox" }),
      field({ label: "Raucher", type: "checkbox" }),
    ];
    expect(
      mapFields(fields, coupleWithDog, letter).mappings.map((m) => m.value),
    ).toEqual([true, true, false]);
  });

  it("joins street and number, and postcode and city, for combined fields", () => {
    const fields = [
      field({ label: "Straße und Hausnummer" }),
      field({ label: "PLZ / Ort" }),
    ];
    expect(
      mapFields(fields, soloStudent, letter).mappings.map((m) => m.value),
    ).toEqual(["Ausgedachter Weg 12a", "12043 Berlin"]);
  });

  it("does not count a field whose profile value is empty", () => {
    const fields = [
      field({ label: "Vorname" }),
      field({ label: "Einzugstermin" }),
      field({ label: "Nachricht", type: "textarea" }),
    ];
    const result = mapFields(fields, defaultProfile(), "");
    expect(result.mappings.map((m) => m.value)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(result).toMatchObject({ matched: 0, total: 3 });
  });
});
