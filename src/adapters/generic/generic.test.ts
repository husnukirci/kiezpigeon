// The fallback reader on invented pages (PLAN.md section 5, adapters):
// it finds the contact form among the page's forms and reads it; the
// matcher's pairs on top are what the panel's preview lists.
import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../test-support/fixtures";
import { coupleWithDog } from "../../../test-support/sample-profiles";
import { mapFields } from "../../rules/fieldMatch";
import { generic } from "./generic";

const LETTER = "Sehr geehrte Frau Beispielfrau, ...";

function pairs(page: Document) {
  const { mappings, matched, total, leftAlone } = mapFields(
    generic.readContactForm(page),
    coupleWithDog,
    LETTER,
  );
  return {
    pairs: mappings.map((m) => [m.field.label ?? m.field.name, m.value]),
    matched,
    total,
    leftAlone: leftAlone.map((f) => f.name),
  };
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("generic.contactForm", () => {
  it("picks the enquiry form over the search box and the newsletter", () => {
    const page = loadFixture("generic", "contact-form.html");
    expect(generic.contactForm(page)?.id).toBe("anfrage");
  });

  it("passes over a login form, though it asks for an email", () => {
    const page = loadFixture("generic", "contact-form-placeholders.html");
    expect(generic.contactForm(page)?.className).toBe("kontakt");
  });

  it("finds no contact form on a page with only a search box", () => {
    const page = parse(
      `<form><label>Suche <input name="q" type="search"></label></form>`,
    );
    expect(generic.contactForm(page)).toBeUndefined();
    expect(generic.readContactForm(page)).toEqual([]);
  });

  it("passes over a hidden form", () => {
    const page = parse(
      `<div hidden><form id="old"><textarea name="m"></textarea></form></div>
       <form id="shown"><textarea name="m"></textarea></form>`,
    );
    expect(generic.contactForm(page)?.id).toBe("shown");
  });

  it("takes a form of three fields without a message box", () => {
    const page = parse(
      `<form id="short"><input name="vorname"><input name="nachname"><input name="email" type="email"></form>`,
    );
    expect(generic.contactForm(page)?.id).toBe("short");
  });
});

describe("generic.readContactForm with the matcher", () => {
  it("pairs a labelled form; the salutation stays for the user", () => {
    expect(pairs(loadFixture("generic", "contact-form.html"))).toEqual({
      pairs: [
        ["Anrede", undefined],
        ["Vorname *", "Mara"],
        ["Nachname *", "Testmann"],
        ["E-Mail *", "mara.testmann@example.org"],
        ["Telefon", "030 5550123"],
        ["Ihre Nachricht *", LETTER],
      ],
      matched: 5,
      total: 6,
      leftAlone: ["datenschutz"],
    });
  });

  it("pairs a form named by placeholders and skips the hidden spam trap", () => {
    expect(
      pairs(loadFixture("generic", "contact-form-placeholders.html")),
    ).toEqual({
      pairs: [
        ["fname", "Mara"],
        ["lname", "Testmann"],
        ["strasse", "Erfundene Straße 7"],
        ["plzort", "10999 Berlin"],
        ["mail", "mara.testmann@example.org"],
        ["Anzahl Erwachsene", 2],
        ["Gewünschter Einzug", "2027-03-01"],
        ["Ich habe Haustiere", true],
        ["Nachricht an uns", LETTER],
      ],
      matched: 9,
      total: 9,
      leftAlone: ["agb"],
    });
  });
});
