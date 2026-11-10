import { describe, expect, it } from "vitest";
import { coupleWithDog, soloStudent } from "../../test-support/sample-profiles";
import { classifyField, mapFields } from "./fieldMatch";
import { defaultProfile } from "./profile";
import type {
  Applicant,
  EmploymentType,
  FieldKind,
  FormField,
  Household,
  Profile,
} from "./types";

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
    [{ label: "Einkommensart", type: "select" }, "incomeType"],
    [{ name: "einkommensart", id: "input-dropdown-income-type" }, "incomeType"],
    [{ name: "incomeType" }, "incomeType"],
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
    expect(result.total).toBe(10);
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
      ["unknown", undefined],
    ]);
    expect(result.leftAlone.map((f) => f.label)).toEqual([
      "Datenschutz akzeptiert",
    ]);
  });

  it("leaves a consent checkbox alone and out of the count", () => {
    const consent = field({ label: "Ich willige ein", type: "checkbox" });
    const result = mapFields([consent], coupleWithDog, letter);
    expect(result.mappings).toEqual([]);
    expect(result.leftAlone).toEqual([consent]);
    expect(result).toMatchObject({ matched: 0, total: 0 });
  });

  it("treats every checkbox that states no household fact as an opt-in", () => {
    const optIns = [
      field({ label: "Anbieter:in darf dein Profil sehen", type: "checkbox" }),
      field({ name: "followAnAgent", type: "checkbox" }),
      field({ label: "Erhalte Angebote von Umzugsfirmen", type: "checkbox" }),
    ];
    const pets = field({ label: "Haustiere", type: "checkbox" });
    const result = mapFields([...optIns, pets], coupleWithDog, letter);
    expect(result.leftAlone).toEqual(optIns);
    expect(result.mappings.map((m) => m.field)).toEqual([pets]);
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

  it("maps household, income, job and WBS as values a field can hold", () => {
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
      "4600",
      "Softwareentwicklerin",
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

  it("inverts the value for a no-pets field", () => {
    for (const label of [
      "Keine Haustiere",
      "Ohne Haustiere",
      "No pets",
      "Haustiere: keine",
    ]) {
      const box = field({ label, type: "checkbox" });
      expect(mapFields([box], coupleWithDog, "").mappings[0]?.value).toBe(
        false,
      );
      expect(mapFields([box], soloStudent, "").mappings[0]?.value).toBe(true);
    }
    const plain = field({ label: "Haustiere", type: "checkbox" });
    expect(mapFields([plain], coupleWithDog, "").mappings[0]?.value).toBe(true);
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

  it("writes a German date, ab sofort or flexibel into a text move-in field", () => {
    const text = field({ label: "Einzugstermin" });
    const date = field({ label: "Einzugstermin", type: "date" });
    const valueOf = (profile: Profile, f: FormField) =>
      mapFields([f], profile, letter).mappings[0]?.value;
    expect(valueOf(coupleWithDog, text)).toBe("01.03.2027");
    expect(valueOf(coupleWithDog, date)).toBe("2027-03-01");
    const asap: Profile = { ...coupleWithDog, moveIn: { kind: "asap" } };
    const flexible: Profile = {
      ...coupleWithDog,
      moveIn: { kind: "flexible" },
    };
    expect(valueOf(asap, text)).toBe("ab sofort");
    expect(valueOf(flexible, text)).toBe("flexibel");
    expect(valueOf(asap, date)).toBeUndefined();
  });

  it("marks a field whose different value it would replace", () => {
    const fields = [
      field({ label: "Vorname", value: "Jonas" }),
      field({ label: "Nachname", value: "Testmann" }),
      field({ label: "Telefon", value: "" }),
      // An unticked box is the page's default, not something typed.
      field({ label: "Haustiere", type: "checkbox", checked: false }),
      field({ label: "Raucher", type: "checkbox", checked: true }),
      field({ label: "Lieblingsfarbe", value: "blau" }),
    ];
    expect(
      mapFields(fields, coupleWithDog, letter).mappings.map((m) => m.replaces),
    ).toEqual([true, false, false, false, true, false]);
  });
});

describe("mapFields on select fields", () => {
  const letter = "Sehr geehrte Frau Weber, ...";
  const options = (...pairs: [string, string][]) =>
    pairs.map(([value, label]) => ({ value, label }));
  const select = (label: string, ...pairs: [string, string][]) =>
    field({ label, type: "select", options: options(["", ""], ...pairs) });
  const valueOf = (profile: Profile, f: FormField) =>
    mapFields([f], profile, letter).mappings[0]?.value;

  it("answers yes and no questions with the matching option", () => {
    const pets = select("Haustiere", ["TRUE", "Ja"], ["FALSE", "Nein"]);
    expect(valueOf(coupleWithDog, pets)).toBe("TRUE");
    expect(valueOf(soloStudent, pets)).toBe("FALSE");
    const wbs = select("WBS vorhanden", ["1", "Yes"], ["0", "No"]);
    expect(valueOf(soloStudent, wbs)).toBe("1");
    const smoker = select("Raucher", ["n", "nein"], ["j", "ja"]);
    expect(valueOf(coupleWithDog, smoker)).toBe("n");
  });

  it("says the documents are available in English", () => {
    const documents = select(
      "Application documents",
      ["TRUE", "Available"],
      ["FALSE", "Not available"],
    );
    expect(valueOf(coupleWithDog, documents)).toBe("TRUE");
    expect(valueOf(soloStudent, documents)).toBeUndefined();
  });

  it("picks the move-in option by the kind of move-in", () => {
    const moveIn = select(
      "Einzugstermin",
      ["CONCRETE", "genaues Datum"],
      ["FLEXIBLE", "flexibel"],
      ["FROM_NOW", "ab sofort"],
    );
    expect(valueOf(coupleWithDog, moveIn)).toBe("CONCRETE");
    expect(
      valueOf({ ...coupleWithDog, moveIn: { kind: "asap" } }, moveIn),
    ).toBe("FROM_NOW");
    expect(
      valueOf({ ...coupleWithDog, moveIn: { kind: "flexible" } }, moveIn),
    ).toBe("FLEXIBLE");
    expect(valueOf(soloStudent, moveIn)).toBeUndefined();
  });

  it("picks the income range that holds the household's net income", () => {
    const income = select(
      "Monatliches netto Haushaltseinkommen",
      ["BELOW_500", "< 500 €"],
      ["OVER_500_UPTO_1000", "500 - 1.000 €"],
      ["OVER_1000_UPTO_1500", "1.000 - 1.500 €"],
      ["OVER_4000_UPTO_5000", "4.000 - 5.000 €"],
      ["OVER_5000", "> 5.000 €"],
    );
    expect(valueOf(coupleWithDog, income)).toBe("OVER_4000_UPTO_5000");
    expect(valueOf(soloStudent, income)).toBe("OVER_500_UPTO_1000");
    const atEdge = (cents: number): Profile => ({
      ...soloStudent,
      applicants: soloStudent.applicants.map((a) => ({
        ...a,
        netIncomeCents: cents,
      })),
    });
    expect(valueOf(atEdge(100000), income)).toBe("OVER_500_UPTO_1000");
    expect(valueOf(atEdge(100001), income)).toBe("OVER_1000_UPTO_1500");
    expect(valueOf(atEdge(40000), income)).toBe("BELOW_500");
    expect(valueOf(atEdge(900000), income)).toBe("OVER_5000");
  });

  it("does not depend on the order of the options", () => {
    const income = select(
      "Einkommen",
      ["HIGH", "1.000 - 1.500 €"],
      ["LOW", "500 - 1.000 €"],
    );
    const atThousand: Profile = {
      ...soloStudent,
      applicants: soloStudent.applicants.map((a) => ({
        ...a,
        netIncomeCents: 100000,
      })),
    };
    expect(valueOf(atThousand, income)).toBe("LOW");
    const documents = select(
      "Bewerbungsunterlagen",
      ["FALSE", "Nicht vorhanden"],
      ["TRUE", "Vorhanden"],
    );
    expect(valueOf(coupleWithDog, documents)).toBe("TRUE");
  });

  it("takes the band above a gap at its lower bound", () => {
    const income = select(
      "Monatliches Nettoeinkommen",
      ["M_1", "bis 2.000 EUR"],
      ["M_2", "2.001 - 3.000 EUR"],
      ["M_3", "über 3.000 EUR"],
      ["M_A", "keine Angabe"],
    );
    const atEdge = (cents: number): Profile => ({
      ...soloStudent,
      applicants: soloStudent.applicants.map((a) => ({
        ...a,
        netIncomeCents: cents,
      })),
    });
    expect(valueOf(atEdge(200000), income)).toBe("M_1");
    // Between the two bands, as a sum with cents can be.
    expect(valueOf(atEdge(200050), income)).toBe("M_1");
    expect(valueOf(atEdge(200100), income)).toBe("M_2");
    expect(valueOf(atEdge(300000), income)).toBe("M_2");
    expect(valueOf(atEdge(300050), income)).toBe("M_3");
  });

  it("names own income only when every applicant's job means own income", () => {
    const incomeType = select(
      "Einkommensart",
      ["1", "eigenes Einkommen (Gehalt, Lohn, Unterhalt)"],
      ["2", "Arbeitslosengeld, Sozialhilfe"],
      ["3", "Rente, Pension"],
      ["4", "Bürgergeld"],
    );
    const as = (...jobs: EmploymentType[]): Profile => ({
      ...coupleWithDog,
      applicants: jobs.map((employment, index) => ({
        ...(coupleWithDog.applicants[0] as Applicant),
        id: `a${String(index + 1)}`,
        employment,
      })),
    });
    for (const job of [
      "permanent",
      "fixed_term",
      "civil_servant",
      "self_employed",
      "trainee",
    ] satisfies EmploymentType[]) {
      expect(valueOf(as(job), incomeType)).toBe("1");
    }
    expect(valueOf(as("permanent", "fixed_term"), incomeType)).toBe("1");
    for (const job of [
      "student",
      "job_seeking",
      "other",
    ] satisfies EmploymentType[]) {
      expect(valueOf(as(job), incomeType)).toBeUndefined();
    }
    expect(valueOf(as("permanent", "student"), incomeType)).toBeUndefined();
    // A list with no such option gets no guess.
    expect(
      valueOf(as("permanent"), select("Einkommensart", ["4", "Bürgergeld"])),
    ).toBeUndefined();
  });

  it("leaves a typed income type alone", () => {
    expect(
      valueOf(coupleWithDog, field({ label: "Einkommensart" })),
    ).toBeUndefined();
  });

  it("leaves an income select alone when no range holds the income", () => {
    const income = select("Einkommen", ["A", "1.000 - 1.500 €"]);
    expect(valueOf(coupleWithDog, income)).toBeUndefined();
  });

  it("picks the employment option for the first applicant", () => {
    const employment = select(
      "Beschäftigungsart",
      ["PUBLIC_EMPLOYEE", "Angestellte:r"],
      ["WORKER", "Arbeiter:in"],
      ["SELF_EMPLOYED", "Selbstständige:r"],
      ["OFFICER", "Beamter:Beamtin"],
      ["TRAINEE", "Auszubildende:r"],
      ["STUDENT", "Student:in"],
      ["UNEMPLOYED", "Arbeitssuchende:r"],
      ["OTHER", "Sonstiges"],
    );
    const as = (employment: EmploymentType): Profile => ({
      ...coupleWithDog,
      applicants: coupleWithDog.applicants
        .slice(0, 1)
        .map((a) => ({ ...a, employment })),
    });
    expect(valueOf(as("permanent"), employment)).toBe("PUBLIC_EMPLOYEE");
    expect(valueOf(as("fixed_term"), employment)).toBe("PUBLIC_EMPLOYEE");
    expect(valueOf(as("civil_servant"), employment)).toBe("OFFICER");
    expect(valueOf(as("self_employed"), employment)).toBe("SELF_EMPLOYED");
    expect(valueOf(as("trainee"), employment)).toBe("TRAINEE");
    expect(valueOf(as("student"), employment)).toBe("STUDENT");
    expect(valueOf(as("other"), employment)).toBe("OTHER");
    expect(valueOf(as("job_seeking"), employment)).toBe("UNEMPLOYED");
  });

  it("picks the household option from adults, children and relationship", () => {
    const household = select(
      "Haushaltsgröße",
      ["ONE_PERSON", "Einpersonenhaushalt"],
      ["TWO_PERSON", "Zwei Erwachsene"],
      ["FAMILY", "Familie"],
      ["BIG_GROUP", "Wohngemeinschaft"],
    );
    const withHousehold = (h: Partial<Household>): Profile => ({
      ...coupleWithDog,
      household: { ...coupleWithDog.household, ...h },
    });
    expect(valueOf(soloStudent, household)).toBe("ONE_PERSON");
    expect(valueOf(coupleWithDog, household)).toBe("TWO_PERSON");
    expect(valueOf(withHousehold({ children: 1 }), household)).toBe("FAMILY");
    expect(
      valueOf(withHousehold({ relationship: "flatmates" }), household),
    ).toBe("BIG_GROUP");
    expect(valueOf(withHousehold({ adults: 1, children: 2 }), household)).toBe(
      "FAMILY",
    );
  });

  it("says the documents are there only when every one is ready", () => {
    const documents = select(
      "Bewerbungsunterlagen",
      ["TRUE", "Vorhanden"],
      ["FALSE", "Nicht vorhanden"],
    );
    expect(classifyField(documents)).toBe("documents");
    // The WBS paper only counts for someone who has a WBS.
    expect(valueOf(coupleWithDog, documents)).toBe("TRUE");
    expect(valueOf(soloStudent, documents)).toBeUndefined();
  });

  it("has no option to pick for a salutation, and counts it unmatched", () => {
    const salutation = select("Anrede *", ["FEMALE", "Frau"], ["MALE", "Herr"]);
    const result = mapFields([salutation], coupleWithDog, letter);
    expect(result).toMatchObject({ matched: 0, total: 1 });
  });

  it("marks a select whose chosen option it would change", () => {
    const pets = (value: string) =>
      field({
        label: "Haustiere",
        type: "select",
        value,
        options: options(["", ""], ["TRUE", "Ja"], ["FALSE", "Nein"]),
      });
    const replaces = (f: FormField) =>
      mapFields([f], coupleWithDog, letter).mappings[0]?.replaces;
    expect(replaces(pets(""))).toBe(false);
    expect(replaces(pets("TRUE"))).toBe(false);
    expect(replaces(pets("FALSE"))).toBe(true);
  });

  it("reads an income bound only from whole words", () => {
    const income = select("Einkommen", ["X", "3.000 € abzüglich Steuern"]);
    expect(valueOf(coupleWithDog, income)).toBeUndefined();
  });

  // Options whose values equal their labels, and the value for a profile.
  const choice = (label: string, labels: string[]) =>
    select(label, ...labels.map((text): [string, string] => [text, text]));
  const chosen = (f: FormField, profile: Profile) => valueOf(profile, f);
  const family: Profile = {
    ...coupleWithDog,
    household: { ...coupleWithDog.household, children: 1 },
  };

  it("never picks a no-answer option", () => {
    const pets = choice("Haustiere", [
      "Bitte wählen",
      "Keine Angabe",
      "Ja",
      "Nein",
    ]);
    expect(chosen(pets, soloStudent)).toBe("Nein");
    expect(chosen(pets, coupleWithDog)).toBe("Ja");
  });

  it("tells a household with children from one without", () => {
    const household = choice("Haushaltsgröße", [
      "Single",
      "Paar ohne Kinder",
      "Paar mit Kindern",
    ]);
    expect(chosen(household, family)).toBe("Paar mit Kindern");
    expect(chosen(household, coupleWithDog)).toBe("Paar ohne Kinder");
    const reversed = choice("Haushaltsgröße", [
      "Paar mit Kindern",
      "Paar ohne Kinder",
    ]);
    expect(chosen(reversed, coupleWithDog)).toBe("Paar ohne Kinder");
  });

  it("counts a singular Kind option as a household with children", () => {
    const options = ["2 Erwachsene, 1 Kind", "2 Erwachsene"];
    const household = choice("Haushaltsgröße", options);
    expect(chosen(household, family)).toBe("2 Erwachsene, 1 Kind");
    expect(chosen(household, coupleWithDog)).toBe("2 Erwachsene");
    const reversed = choice("Haushaltsgröße", [
      "2 Erwachsene mit Kind",
      "2 Erwachsene",
    ]);
    expect(chosen(reversed, coupleWithDog)).toBe("2 Erwachsene");
    expect(chosen(reversed, family)).toBe("2 Erwachsene mit Kind");
  });

  it("reads income bands written with cents", () => {
    const income = choice("Haushaltsnettoeinkommen", [
      "bis 2.000,00 €",
      "2.000,01 - 4.000,00 €",
      "4.000,01 - 5.000,00 €",
      "über 5.000,00 €",
    ]);
    expect(chosen(income, coupleWithDog)).toBe("4.000,01 - 5.000,00 €");
  });

  it("writes no income when none was given", () => {
    const profile = defaultProfile();
    const text = field({ label: "Nettoeinkommen" });
    const band = choice("Nettoeinkommen", ["bis 1.000 €", "über 1.000 €"]);
    const { mappings, matched } = mapFields([text, band], profile, "");
    expect(mappings.map((m) => m.value)).toEqual([undefined, undefined]);
    expect(matched).toBe(0);
  });
});

describe("autocomplete tokens and phone formats", () => {
  it("reads the field name out of a multi-token autocomplete", () => {
    expect(
      classifyField(field({ autocomplete: "shipping given-name", name: "x" })),
    ).toBe("firstName");
    expect(
      classifyField(
        field({ autocomplete: "section-a billing postal-code", name: "x" }),
      ),
    ).toBe("postcode");
    expect(classifyField(field({ autocomplete: "home tel", name: "x" }))).toBe(
      "phone",
    );
    expect(
      classifyField(field({ autocomplete: "off", label: "Vorname" })),
    ).toBe("firstName");
  });

  it("writes street and number into a street-address field", () => {
    for (const autocomplete of ["street-address", "address-line1"]) {
      const { mappings } = mapFields(
        [field({ autocomplete, name: "x" })],
        coupleWithDog,
        "",
      );
      expect(mappings[0]?.value).toBe(
        `${coupleWithDog.contact.street} ${coupleWithDog.contact.houseNumber}`,
      );
    }
  });

  it("reads +49 (0)30 as the same number as 030", () => {
    const phone = field({ label: "Telefon", value: "+49 (0)30 1234567" });
    const profile = {
      ...coupleWithDog,
      contact: { ...coupleWithDog.contact, phone: "030 1234567" },
    };
    expect(mapFields([phone], profile, "").mappings[0]?.replaces).toBe(false);
  });

  it("lets a given-name autocomplete decide whatever the label says", () => {
    const fields = [
      field({ autocomplete: "given-name", label: "Vor- und Nachname" }),
      field({ autocomplete: "family-name", label: "Vor- und Nachname" }),
    ];
    const { mappings } = mapFields(fields, coupleWithDog, "");
    expect(mappings.map((m) => m.value)).toEqual(["Mara", "Testmann"]);
  });

  it("fills the full name only when one field asks for it", () => {
    const shared = "Vor- und Nachname";
    const two = [
      field({ name: "vorname", label: shared }),
      field({ name: "nachname", label: shared }),
    ];
    expect(
      mapFields(two, coupleWithDog, "").mappings.map((m) => m.value),
    ).toEqual(["Mara", "Testmann"]);
    const one = [field({ label: shared })];
    expect(mapFields(one, coupleWithDog, "").mappings[0]?.value).toBe(
      "Mara Testmann",
    );
  });

  it("ignores autocomplete tokens that are not field names", () => {
    expect(
      classifyField(field({ autocomplete: "constructor", label: "Vorname" })),
    ).toBe("firstName");
  });
});

describe("review findings", () => {
  it.each([
    "Einzugsermächtigung IBAN",
    "IBAN für Einzug",
    "Kontoinhaber",
    "BIC",
    "Ausweis-Nr.",
    "Steuer-ID",
    "SEPA-Lastschrift",
  ])("leaves %s unknown", (label) => {
    expect(classifyField(field({ label }))).toBe("unknown");
  });

  it("keeps income after tax and leaves identity documents alone", () => {
    expect(
      classifyField(field({ label: "Nettoeinkommen (nach Steuern)" })),
    ).toBe("income");
    expect(
      classifyField(field({ label: "Monatliches Einkommen nach Steuern" })),
    ).toBe("income");
    expect(classifyField(field({ label: "Personalausweis-Nr." }))).toBe(
      "unknown",
    );
    expect(classifyField(field({ label: "Steuernummer" }))).toBe("unknown");
  });

  it("takes a bare Nr. from the label when there is one", () => {
    expect(classifyField(field({ label: "Kunden-Nr.", name: "nr" }))).toBe(
      "unknown",
    );
    expect(classifyField(field({ label: "Nr.", name: "kunde" }))).toBe(
      "houseNumber",
    );
  });

  it("joins the number into a street field only when its text says so", () => {
    const { mappings } = mapFields(
      [field({ label: "Straße", id: "field-nr-3" })],
      soloStudent,
      "",
    );
    expect(mappings[0]?.value).toBe("Ausgedachter Weg");
    const combined = mapFields(
      [field({ label: "Straße/Nr." })],
      soloStudent,
      "",
    );
    expect(combined.mappings[0]?.value).toBe("Ausgedachter Weg 12a");
  });

  it("reads a bare Nr. as the house number, not a number of something else", () => {
    expect(classifyField(field({ label: "Nr." }))).toBe("houseNumber");
    expect(classifyField(field({ name: "nr" }))).toBe("houseNumber");
    expect(classifyField(field({ label: "WBS-Nr." }))).toBe("wbs");
    expect(classifyField(field({ label: "Kunden-Nr." }))).toBe("unknown");
  });

  it("writes no yes or no into a text field", () => {
    const { mappings } = mapFields(
      [field({ label: "WBS-Nr." })],
      coupleWithDog,
      "",
    );
    expect(mappings[0]?.value).toBeUndefined();
  });

  it("writes first and last name into a field that asks for both", () => {
    for (const label of [
      "Vor- und Nachname",
      "Vor- und Zuname",
      "Vollständiger Name",
      "Full name",
      "Vorname und Nachname",
      "Vorname, Nachname",
      "Vorname/Nachname",
      "Name, Vorname",
    ]) {
      const { mappings } = mapFields([field({ label })], coupleWithDog, "");
      expect(mappings[0]?.value).toBe("Mara Testmann");
    }
    const separate = mapFields(
      [field({ label: "Vorname" }), field({ label: "Nachname" })],
      coupleWithDog,
      "",
    );
    expect(separate.mappings.map((m) => m.value)).toEqual(["Mara", "Testmann"]);
    const { mappings } = mapFields(
      [field({ label: "Nachname" })],
      coupleWithDog,
      "",
    );
    expect(mappings[0]?.value).toBe("Testmann");
  });

  it("does not read the willig in freiwillig as consent", () => {
    expect(classifyField(field({ label: "Telefonnummer (freiwillig)" }))).toBe(
      "phone",
    );
    expect(classifyField(field({ label: "Freiwillige Angabe: Beruf" }))).toBe(
      "employment",
    );
  });

  it.each([
    "Einwilligung",
    "Ich willige ein",
    "Einwilligungserklärung Datenschutz",
  ])("still reads %s as consent", (label) => {
    expect(classifyField(field({ label, type: "checkbox" }))).toBe("consent");
    expect(classifyField(field({ label }))).toBe("consent");
  });

  it("does not read the mobil in Immobilie as a phone field", () => {
    expect(
      classifyField(
        field({
          label: "Nachricht an den Anbieter der Immobilie",
          type: "textarea",
        }),
      ),
    ).toBe("message");
    expect(classifyField(field({ name: "immobilienId" }))).toBe("unknown");
    expect(classifyField(field({ label: "Mobil" }))).toBe("phone");
    expect(classifyField(field({ label: "Mobilnummer" }))).toBe("phone");
  });

  it("does not count radio buttons, which fill never writes", () => {
    const result = mapFields(
      [field({ name: "pets", type: "radio" })],
      coupleWithDog,
      "",
    );
    expect(result).toMatchObject({ matched: 0, total: 0 });
  });

  it("does not call a phone number replaced when only its format differs", () => {
    const phone = (value: string) => field({ label: "Telefonnummer", value });
    const replaces = (value: string) =>
      mapFields([phone(value)], coupleWithDog, "").mappings[0]?.replaces;
    // The profile has 030 5550123.
    expect(replaces("+49 30 5550123")).toBe(false);
    expect(replaces("0049 (30) 555-0123")).toBe(false);
    expect(replaces("030/5550123")).toBe(false);
    expect(replaces("+49 30 5550999")).toBe(true);
  });
});

describe("final review findings", () => {
  it("reads a Name label over a Vorname or Nachname placeholder as one name each", () => {
    const fields = [
      field({ label: "Name", placeholder: "Vorname" }),
      field({ label: "Name", placeholder: "Nachname" }),
    ];
    expect(
      mapFields(fields, coupleWithDog, "").mappings.map((m) => m.value),
    ).toEqual(["Mara", "Testmann"]);
    const placeholderAlone = [field({ placeholder: "Vorname Nachname" })];
    expect(
      mapFields(placeholderAlone, coupleWithDog, "").mappings[0]?.value,
    ).toBe("Mara Testmann");
  });

  it("judges only the shared-label name fields by their own text", () => {
    const shared = "Vor- und Nachname";
    const names = [
      field({ name: "vorname", label: shared }),
      field({ name: "nachname", label: shared }),
    ];
    const others = [
      field({ label: "Haustiere (Art, Anzahl)", type: "textarea" }),
      field({ label: "Datenschutz gelesen", name: "email" }),
      field({ label: "Kunden-Nr.", name: "nr" }),
      field({
        label: "Ich akzeptiere die Datenschutzerklärung",
        name: "pets",
        type: "checkbox",
      }),
    ];
    const kindIn = (fields: FormField[], f: FormField) => {
      const result = mapFields(fields, coupleWithDog, "");
      return result.leftAlone.includes(f)
        ? "left alone"
        : result.mappings.find((m) => m.field === f)?.kind;
    };
    const inForm = [...names, ...others];
    for (const other of others) {
      expect(kindIn(inForm, other)).toBe(kindIn([other], other));
    }
    const { mappings, leftAlone } = mapFields(inForm, coupleWithDog, "");
    expect(mappings.map((m) => m.value).slice(0, 2)).toEqual([
      "Mara",
      "Testmann",
    ]);
    expect(leftAlone).toContain(others[3]);
    expect(mappings.some((m) => m.field === others[3])).toBe(false);
  });

  it("writes the street alone into a street-address field beside a Hausnummer field", () => {
    for (const autocomplete of ["street-address", "address-line1"]) {
      const fields = [
        field({ autocomplete, name: "x" }),
        field({ label: "Hausnummer" }),
      ];
      expect(
        mapFields(fields, coupleWithDog, "").mappings.map((m) => m.value),
      ).toEqual([
        coupleWithDog.contact.street,
        coupleWithDog.contact.houseNumber,
      ]);
    }
  });
});
