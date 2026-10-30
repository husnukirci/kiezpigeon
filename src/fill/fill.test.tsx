// The fill layer (PLAN.md section 5, form adapters): values land, the
// events a framework needs fire, and nothing is ever submitted.
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../../test-support/fixtures";
import { coupleWithDog } from "../../test-support/sample-profiles";
import { generic } from "../adapters/generic/generic";
import { immoscout24 } from "../adapters/immoscout24/immoscout24";
import { mapFields } from "../rules/fieldMatch";
import { fillForm, fillSteps, type FillStep } from "./fill";

describe("fillForm on a React form (the ADR 11 probe)", () => {
  const state: Record<string, string> = {};

  function ControlledForm() {
    const [text, setText] = useState("");
    const [message, setMessage] = useState("");
    const [pets, setPets] = useState("");
    state.text = text;
    state.message = message;
    state.pets = pets;
    return (
      <form>
        <input
          name="firstName"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <textarea
          name="message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
        />
        <select
          name="hasPets"
          value={pets}
          onChange={(e) => {
            setPets(e.target.value);
          }}
        >
          <option value="" />
          <option value="TRUE">Ja</option>
        </select>
      </form>
    );
  }

  it("reaches React's state for inputs, textareas and selects", () => {
    const { container } = render(<ControlledForm />);
    act(() => {
      fillForm(container, [
        { key: "name:firstName", kind: "firstName", value: "Mara" },
        { key: "name:message", kind: "message", value: "Hallo" },
        { key: "name:hasPets", kind: "pets", value: "TRUE" },
      ]);
    });
    expect(state).toEqual({ text: "Mara", message: "Hallo", pets: "TRUE" });
  });

  it("shows why: a plain assignment changes the page but not React", () => {
    const { container } = render(<ControlledForm />);
    const input = container.querySelector("input");
    act(() => {
      if (!input) return;
      input.value = "Mara";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input?.value).toBe("Mara");
    expect(state.text).toBe("");
  });
});

/** Records every way a form can be sent, so a test sees any attempt. */
function recordSendAttempts(page: Document, form: HTMLFormElement): string[] {
  const attempts: string[] = [];
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    attempts.push("submit event");
  });
  page.addEventListener("click", () => attempts.push("click"), true);
  form.addEventListener("reset", () => attempts.push("reset"));
  for (const type of ["keydown", "keyup", "keypress", "focusin"]) {
    page.addEventListener(type, () => attempts.push(type), true);
  }
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {
    attempts.push("form.submit()");
  });
  vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(
    () => {
      attempts.push("form.requestSubmit()");
    },
  );
  return attempts;
}

describe("fillForm on the ImmoScout24 contact form", () => {
  let page: Document;
  let form: HTMLFormElement;
  let attempts: string[];

  beforeEach(() => {
    page = loadFixture("immoscout24", "contact-form.html");
    const found = immoscout24.contactForm(page);
    if (!found) throw new Error("fixture has no contact form");
    form = found;
    attempts = recordSendAttempts(page, form);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function plan(): FillStep[] {
    const { mappings } = mapFields(
      immoscout24.readContactForm(page),
      coupleWithDog,
      "Sehr geehrte Frau Beispiel, ...",
    );
    return fillSteps(mappings);
  }

  const valueOf = (name: string) =>
    (form.elements.namedItem(name) as HTMLInputElement | null)?.value;

  it("fills every matched field and leaves the form unsubmitted", () => {
    const report = fillForm(form, plan());
    expect(report.skipped).toEqual([]);
    expect(report.filled).toHaveLength(14);
    expect(attempts).toEqual([]);
    expect(valueOf("message")).toBe("Sehr geehrte Frau Beispiel, ...");
    expect(valueOf("firstName")).toBe("Mara");
    expect(valueOf("phoneNumber")).toBe("030 5550123");
    expect(valueOf("hasPets")).toBe("TRUE");
    expect(valueOf("income")).toBe("OVER_4000_UPTO_5000");
    // Not matched, so not touched.
    expect(valueOf("salutation")).toBe("");
  });

  it("fires input then change on each field it writes", () => {
    const events: string[] = [];
    for (const type of ["input", "change"]) {
      form.addEventListener(type, (e) => {
        events.push(`${type}:${(e.target as HTMLInputElement).name}`);
      });
    }
    fillForm(form, [
      { key: "name:firstName", kind: "firstName", value: "Mara" },
      { key: "name:hasPets", kind: "pets", value: "TRUE" },
    ]);
    expect(events).toEqual([
      "input:firstName",
      "change:firstName",
      "input:hasPets",
      "change:hasPets",
    ]);
  });

  it("refuses opt-ins, disabled fields and options the select lacks", () => {
    const report = fillForm(form, [
      { key: "name:followAnAgent", kind: "consent", value: false },
      { key: "name:emailAddress", kind: "email", value: "x@example.org" },
      { key: "name:hasPets", kind: "pets", value: "MAYBE" },
      { key: "name:gone", kind: "city", value: "Berlin" },
    ]);
    expect(report).toEqual({
      filled: [],
      skipped: [
        { key: "name:followAnAgent", reason: "refused" },
        { key: "name:emailAddress", reason: "refused" },
        { key: "name:hasPets", reason: "no_option" },
        { key: "name:gone", reason: "missing" },
      ],
    });
    const optIn = form.elements.namedItem("followAnAgent") as HTMLInputElement;
    expect(optIn.checked).toBe(true);
    expect(valueOf("emailAddress")).toBe("jonas.vorbelegt@example.org");
    expect(attempts).toEqual([]);
  });

  it("refuses an opt-in checkbox whatever kind the plan claims", () => {
    const report = fillForm(form, [
      { key: "name:followAnAgent", kind: "pets", value: false },
      {
        key: "id:is24-checkbox-isRelocationOfferChecked-input",
        kind: "smoker",
        value: true,
      },
    ]);
    expect(report.filled).toEqual([]);
    const optIn = form.elements.namedItem("followAnAgent") as HTMLInputElement;
    expect(optIn.checked).toBe(true);
    expect(
      page.getElementById("is24-checkbox-isRelocationOfferChecked-input"),
    ).toHaveProperty("checked", false);
  });

  it("never writes a file input or presses a button", () => {
    form.insertAdjacentHTML("beforeend", '<input type="file" name="upload">');
    const report = fillForm(form, [
      { key: "name:upload", kind: "unknown", value: "C:\\cv.pdf" },
    ]);
    expect(report.skipped).toEqual([{ key: "name:upload", reason: "refused" }]);
    expect(attempts).toEqual([]);
  });
});

describe.each(["contact-form.html", "contact-form-placeholders.html"])(
  "fillForm on the generic fixture %s (ADR 12)",
  (fixture) => {
    let page: Document;
    let form: HTMLFormElement;
    let attempts: string[];

    beforeEach(() => {
      page = loadFixture("generic", fixture);
      const found = generic.contactForm(page);
      if (!found) throw new Error("fixture has no contact form");
      form = found;
      attempts = recordSendAttempts(page, form);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const mappings = () =>
      mapFields(generic.readContactForm(page), coupleWithDog, "Hallo").mappings;

    it("fills every matched field and leaves the form unsubmitted", () => {
      const steps = fillSteps(mappings());
      const report = fillForm(form, steps);
      expect(report.filled).toEqual(steps.map((step) => step.key));
      expect(report.skipped).toEqual([]);
      expect(attempts).toEqual([]);
      expect(form.querySelector("textarea")?.value).toBe("Hallo");
      for (const box of form.querySelectorAll<HTMLInputElement>(
        "[name=datenschutz], [name=agb]",
      )) {
        expect(box.checked).toBe(false);
      }
    });

    it("leaves a field the user opted out of as it was", () => {
      const all = mappings();
      const optedOut = all.find((m) => m.kind === "email")?.field.key;
      expect(optedOut).toBeDefined();
      const steps = fillSteps(all, new Set([optedOut ?? ""]));
      fillForm(form, steps);
      expect(steps.map((step) => step.key)).not.toContain(optedOut);
      expect(form.querySelector<HTMLInputElement>("[type=email]")?.value).toBe(
        "",
      );
      expect(form.querySelector("textarea")?.value).toBe("Hallo");
    });
  },
);
