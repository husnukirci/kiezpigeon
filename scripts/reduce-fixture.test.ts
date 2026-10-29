import { describe, expect, it } from "vitest";
import { reduce, replaceAll, suspicious } from "./reduce-fixture";

describe("reduce", () => {
  it("drops scripts, styles, inline SVG and the signed-in header", () => {
    const html = reduce(
      [
        '<header class="page-header">angemeldet als Max Mustermann</header>',
        '<script>var keyValues = {"obj_scoutId":"100000003"};</script>',
        "<svg><defs><style>.a{fill:red}</style></defs></svg>",
        '<p class="is24qa-kaltmiete" style="color:red" data-tracking="x">750 €</p>',
      ].join("\n"),
    );
    expect(html).toBe('<p class="is24qa-kaltmiete">750 €</p>');
  });

  it("keeps what adapters read and drops tracking ids and links", () => {
    expect(
      reduce(
        '<div id="batBeacon721015988270" data-qa="contactName"><a href="https://example.org/x?t=1">x</a></div>',
      ),
    ).toBe('<div data-qa="contactName"><a href="#">x</a></div>');
  });

  it("keeps the charset meta and drops the others", () => {
    expect(
      reduce(
        '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="description" content="Musterweg 5">',
      ),
    ).toBe('<meta charset="utf-8">');
  });
});

describe("replaceAll", () => {
  it("replaces longer real values before their prefixes", () => {
    expect(
      replaceAll("Beispielstraße 12, Beispielstraße", {
        Beispielstraße: "Musterweg",
        "Beispielstraße 12": "Musterweg 5",
      }),
    ).toBe("Musterweg 5, Musterweg");
  });
});

describe("suspicious", () => {
  it("flags emails, phone shapes, long ids and street addresses", () => {
    expect(
      suspicious(
        "a@example.org, 030 5550123, id 100000003, Musterweg 5, Beispieler Straße 91",
      ),
    ).toEqual([
      "email: a@example.org",
      "phone: 030 5550123",
      "long number (id?): 100000003",
      "street: Musterweg 5",
      "street: Beispieler Straße 91",
    ]);
  });
});
