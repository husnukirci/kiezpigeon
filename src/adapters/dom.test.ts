import { describe, expect, it } from "vitest";
import { visibleText } from "./dom";

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

describe("visibleText", () => {
  it("drops script, style, noscript and template content and collapses whitespace", () => {
    const page = parse(
      `<div id="r">  Helle   Wohnung
        <script>var secret = 1;</script><style>p { color: red }</style>
        <noscript>Bitte JavaScript</noscript><template>Vorlage</template>
        <p>987,65&nbsp;€</p></div>`,
    );
    const root = page.querySelector("#r") as Element;
    expect(visibleText(root)).toBe("Helle Wohnung 987,65 €");
  });

  it("keeps words of neighbouring elements apart", () => {
    const page = parse(
      `<div id="r"><p>A</p><p>B</p><dt>Kaltmiete</dt><dd>876 €</dd>C<br>D</div>`,
    );
    expect(visibleText(page.querySelector("#r") as Element)).toBe(
      "A B Kaltmiete 876 € C D",
    );
  });

  it("drops hidden and aria-hidden elements", () => {
    const page = parse(
      `<div id="r">Sichtbar<p hidden>Versteckt</p><p aria-hidden="true">Deko</p></div>`,
    );
    expect(visibleText(page.querySelector("#r") as Element)).toBe("Sichtbar");
  });

  it("leaves the page itself untouched", () => {
    const page = parse(`<div id="r">Text<script>x()</script></div>`);
    visibleText(page.querySelector("#r") as Element);
    expect(page.querySelector("script")).not.toBeNull();
  });
});
