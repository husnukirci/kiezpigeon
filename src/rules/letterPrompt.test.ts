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
  incomeBand,
  incomeRatioPhrase,
  salutationFor,
} from "./letterPrompt";
import type { LetterRequest, Listing } from "./types";

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
      "moveIn",
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
        "- Mara Testmann, Softwareentwicklerin, unbefristete Festanstellung",
        "- Jonas Beispiel, Lehrer, verbeamtet",
        "Haushaltsnettoeinkommen: zwischen 4.000 und 5.000 € im Monat",
        "Haushalt: 2 Erwachsene, keine Kinder, Nichtraucher",
        "Beziehung: ein Paar",
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
        "2. Einkommen mehr als das Dreifache der Kaltmiete",
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
        "- Pia Musterfrau, Studentin, im Studium",
        "Haushaltsnettoeinkommen: zwischen 500 und 1.000 € im Monat",
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
    expect(system).toContain("the way a native speaker writes to a landlord");
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

  it("gives every tone a word target well inside the length", () => {
    const targets = (["warm", "formal", "short"] as const).map((tone) => {
      const { system } = buildLetterPrompt({ ...strong, tone });
      expect(system).not.toContain("lower end");
      const match = /aim for about (\d+) words/.exec(system);
      return Number(match?.[1]);
    });
    expect(targets).toEqual([150, 150, 140]);
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

  it("forbids a move-in date the applicants did not give", () => {
    const solo = createLetterRequest(soloStudent, kreuzbergListing, {
      tone: "short",
      features: ["Balkon"],
    });
    expect(buildLetterPrompt(solo).system).toContain(
      "- The applicants gave no move-in date. Do not say when they want to move in or that the listing's date suits them.",
    );
    expect(buildLetterPrompt(strong).system).not.toContain(
      "gave no move-in date",
    );
  });

  describe("how the applicants are related", () => {
    const couple = (
      relationship: LetterRequest["household"]["relationship"],
    ): LetterRequest => {
      const household = { ...strong.household };
      if (relationship) household.relationship = relationship;
      else delete household.relationship;
      return { ...strong, household };
    };
    const noGender =
      " Do not describe either applicant's gender or call one the other's girlfriend, boyfriend, wife or husband (Freundin, Freund, Partnerin, Lebensgefährtin, Ehefrau, Ehemann).";

    it.each([
      [
        "partners",
        "Beziehung: ein Paar",
        `- Say once, briefly, that the applicants are a couple.${noGender}`,
      ],
      [
        "married",
        "Beziehung: verheiratet",
        `- Say once, briefly, that the applicants are married.${noGender}`,
      ],
      [
        "flatmates",
        "Beziehung: Wohngemeinschaft",
        "- Say once, briefly, that the applicants share the flat as flatmates. Do not describe either applicant's gender.",
      ],
      [
        "family",
        "Beziehung: Familie",
        "- Say once, briefly, that the applicants are family. Do not name the family relation (such as Schwester, Bruder, Sohn or Tochter) or describe either applicant's gender.",
      ],
    ] as const)(
      "states %s once, without gender",
      (relationship, fact, rule) => {
        const { system, user } = buildLetterPrompt(couple(relationship));
        expect(user).toContain(fact);
        expect(system).toContain(rule);
      },
    );

    it("forbids guessing when two applicants leave it unsaid", () => {
      const { system, user } = buildLetterPrompt(couple(undefined));
      expect(user).not.toContain("Beziehung");
      expect(system).toContain(
        "- Do not say how the applicants are related to each other.",
      );
    });

    it("drops a relationship a single applicant cannot have", () => {
      const solo = createLetterRequest(
        {
          ...soloStudent,
          household: { ...soloStudent.household, relationship: "married" },
        },
        kreuzbergListing,
        { tone: "short", features: ["Balkon"] },
      );
      expect(solo.household.relationship).toBeUndefined();
      const { system, user } = buildLetterPrompt(solo);
      expect(user).not.toContain("Beziehung");
      expect(system).not.toContain("related to each other");
    });
  });

  describe("move-in and availability", () => {
    const withMoveIn = (moveIn: LetterRequest["moveIn"]): LetterRequest => ({
      ...strong,
      moveIn,
    });
    const withAvailability = (
      availability: Listing["availability"],
    ): LetterRequest => ({
      ...strong,
      listing: { ...strong.listing, availability },
    });

    it("states each move-in kind among the facts", () => {
      expect(buildLetterPrompt(strong).user).toContain(
        "Gewünschter Einzug: 01.03.2027",
      );
      expect(buildLetterPrompt(withMoveIn({ kind: "asap" })).user).toContain(
        "Einzug: ab sofort möglich",
      );
      expect(
        buildLetterPrompt(withMoveIn({ kind: "flexible" })).user,
      ).toContain("Einzug: beim Termin flexibel");
    });

    it("says when the flat is free in the listing's own words", () => {
      expect(
        buildLetterPrompt(withAvailability({ kind: "immediately" })).user,
      ).toContain("- Frei ab: sofort");
      expect(
        buildLetterPrompt(withAvailability({ kind: "by_arrangement" })).user,
      ).toContain("- Frei ab: nach Vereinbarung");
    });

    it("calls a move-in date fitting only when it is close after the free date", () => {
      const signal = (date: string): boolean =>
        buildLetterPrompt(withMoveIn({ kind: "date", date })).user.includes(
          "passend zum Bezugstermin",
        );
      // The flat is free from 01.03.2027.
      expect(signal("2027-03-01")).toBe(true);
      expect(signal("2027-03-20")).toBe(true);
      expect(signal("2027-02-15")).toBe(false);
      expect(signal("2027-05-01")).toBe(false);
    });

    it("counts moving in now or flexibly as a strong signal", () => {
      const lastSignal = (request: LetterRequest): string | undefined =>
        buildLetterPrompt(request).user.split("\n").at(-1);
      expect(lastSignal(withMoveIn({ kind: "asap" }))).toBe(
        "4. Einzug ab sofort möglich",
      );
      expect(lastSignal(withMoveIn({ kind: "flexible" }))).toBe(
        "4. Beim Einzugstermin flexibel",
      );
    });

    it("forbids a move-in claim only when no move-in is stated", () => {
      for (const kind of ["asap", "flexible"] as const) {
        expect(buildLetterPrompt(withMoveIn({ kind })).system).not.toContain(
          "gave no move-in date",
        );
      }
    });
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

describe("incomeBand", () => {
  it("names the household income in the bands contact forms use", () => {
    const cases: [number, string][] = [
      [40000, "unter 500 €"],
      [50000, "unter 500 €"],
      [50001, "zwischen 500 und 1.000 €"],
      [95000, "zwischen 500 und 1.000 €"],
      [150000, "zwischen 1.000 und 1.500 €"],
      [199900, "zwischen 1.500 und 2.000 €"],
      [262300, "zwischen 2.000 und 3.000 €"],
      [400000, "zwischen 3.000 und 4.000 €"],
      [460000, "zwischen 4.000 und 5.000 €"],
      [500001, "über 5.000 €"],
      [1200000, "über 5.000 €"],
    ];
    for (const [cents, phrase] of cases) {
      expect([cents, incomeBand(cents).phrase]).toEqual([cents, phrase]);
    }
    expect(incomeBand(460000).euros).toEqual([4000, 5000]);
  });
});

describe("incomeRatioPhrase", () => {
  it("says the ratio in words, rounded down, and only from three times up", () => {
    const withRent = (kaltmieteCents: number): LetterRequest => ({
      ...strong,
      listing: { ...strong.listing, kaltmieteCents },
    });
    // 4.600 € income.
    expect(incomeRatioPhrase(withRent(118000))).toBe("mehr als das Dreifache");
    expect(incomeRatioPhrase(withRent(115000))).toBe("das Vierfache");
    expect(incomeRatioPhrase(withRent(90000))).toBe("mehr als das Fünffache");
    expect(incomeRatioPhrase(withRent(40000))).toBe("mehr als das Zehnfache");
    expect(incomeRatioPhrase(withRent(160000))).toBeUndefined();
  });
});

describe("natural letters", () => {
  it("asks for plain native German and names the phrases to avoid", () => {
    const { system } = buildLetterPrompt(strong);
    expect(system).toContain("Short, clear sentences");
    for (const phrase of [
      "hiermit bewerbe ich mich",
      "mit großem Interesse",
      "mit großer Freude",
    ]) {
      expect(system).toContain(phrase);
    }
  });

  it("forbids self-praise and claims about fitting the flat", () => {
    const { system } = buildLetterPrompt(strong);
    expect(system).toContain("Do not praise the applicants");
    expect(system).toContain("zuverlässig");
  });

  it("forbids offers the facts do not hold, and talk of affordability", () => {
    const { system } = buildLetterPrompt(strong);
    expect(system).toContain("Do not offer anything the facts do not contain");
    expect(system).toContain("Bürgschaft");
  });

  it("gives the income only as the band, never per person or exact", () => {
    const { system, user } = buildLetterPrompt(strong);
    expect(user).not.toMatch(/2\.600|2\.000 €|4\.600/);
    expect(system).toContain(
      "State the household income only as the range given",
    );
  });

  it("says a job search plainly with the last role, and claims no job", () => {
    const seeking = createLetterRequest(
      {
        ...coupleWithDog,
        applicants: coupleWithDog.applicants.map((a, i) =>
          i === 0
            ? { ...a, job: "Teamleiterin", employment: "job_seeking" }
            : a,
        ),
      },
      kreuzbergListing,
      { tone: "warm", features: ["Balkon"] },
    );
    const { system, user } = buildLetterPrompt(seeking);
    expect(user).toContain(
      "- Mara Testmann, zuletzt Teamleiterin, derzeit auf Stellensuche",
    );
    expect(system).toContain(
      "- Mara Testmann is looking for a new job; Teamleiterin was the last role.",
    );
    // Jonas is still verbeamtet, so secure employment stays a signal.
    expect(user).toContain("1. Sichere Anstellung");
  });
});
