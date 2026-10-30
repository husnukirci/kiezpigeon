import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { passingLetter } from "../../../../test-support/sample-letters";
import {
  coupleWithDog,
  kreuzbergListing,
} from "../../../../test-support/sample-profiles";
import { createLetterRequest } from "../../../rules/letterPrompt";
import { countWords } from "../../../rules/letterValidate";
import type { Application, FormField } from "../../../rules/types";
import type { ContactFormState } from "../../hooks/useContactForm";
import type { LetterState } from "../../hooks/useLetter";
import { LetterReady } from "./LetterReady";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const request = createLetterRequest(coupleWithDog, kreuzbergListing, {
  tone: "warm",
  features: ["Balkon", "Altbau"],
});
const ready: LetterState = {
  status: "ready",
  request,
  draft: { text: passingLetter, problems: [], attempts: 1 },
};

const field = (partial: Partial<FormField> & { key: string }): FormField => ({
  type: "text",
  visible: true,
  disabled: false,
  ...partial,
});

/** A small contact form as the content script would describe it. */
const contactFields: FormField[] = [
  field({ key: "name:message", type: "textarea", label: "Nachricht" }),
  field({
    key: "name:salutation",
    type: "select",
    label: "Anrede *",
    options: [{ value: "MALE", label: "Herr" }],
  }),
  field({ key: "name:firstName", label: "Vorname *", value: "Jonas" }),
  field({ key: "name:phone", label: "Telefonnummer", value: "" }),
  field({
    key: "name:followAnAgent",
    type: "checkbox",
    label: "Anbieter:in folgen",
    checked: true,
  }),
];
const contactForm: ContactFormState = {
  status: "form",
  fields: contactFields,
};
const formKeys = contactFields.map((f) => f.key);

function renderWith(
  state: Exclude<LetterState, { status: "idle" }>,
  form: ContactFormState = { status: "no_form" },
  confirmFirst = false,
  saved?: Application,
) {
  const props = {
    onTone: vi.fn(),
    onRewrite: vi.fn(),
    onBack: vi.fn(),
    onCheckForm: vi.fn(),
    onFill: vi.fn(),
    onSent: vi.fn(),
  };
  const ui = (form: ContactFormState, saved?: Application) => (
    <LetterReady
      state={state}
      profile={coupleWithDog}
      listingTitle={kreuzbergListing.title}
      form={form}
      confirmFirst={confirmFirst}
      saved={saved}
      {...props}
    />
  );
  const { rerender } = render(ui(form, saved));
  return {
    ...props,
    rerender: (form: ContactFormState, saved?: Application) => {
      rerender(ui(form, saved));
    },
  };
}

const filledReport = {
  filled: ["name:message", "name:firstName"],
  skipped: [],
};

describe("LetterReady", () => {
  it("shows the letter on paper with its checks and actions", () => {
    renderWith(ready);
    expect(screen.getByRole("heading", { name: "Letter ready" })).toBeDefined();
    expect(screen.getByText(/^Sehr geehrte Frau Weber,/)).toBeDefined();
    expect(screen.getByText("150 words")).toBeDefined();
    expect(screen.getByText("Passes every letter check")).toBeDefined();
    for (const name of ["Rewrite", "Edit", "Copy"]) {
      expect(screen.getByRole("button", { name })).toBeDefined();
    }
    expect(
      screen.getByRole("button", { name: "Fill the form" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByText("You review and press Send yourself."),
    ).toBeDefined();
  });

  it("asks you to open the contact form, and checks again on a click", () => {
    const props = renderWith(ready);
    expect(screen.getByText(/press Nachricht on the page/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Check the form" }));
    expect(props.onCheckForm).toHaveBeenCalledOnce();
  });

  it("shows the match count, what is left and what a fill replaces", () => {
    renderWith(ready, contactForm);
    expect(screen.getByText("3 of 4 matched")).toBeDefined();
    expect(screen.getByText("Fill these yourself: Anrede.")).toBeDefined();
    expect(
      screen.getByText("Replaces what the page already has: Vorname."),
    ).toBeDefined();
    expect(
      screen.getByText("Left as you set them: Anbieter:in folgen."),
    ).toBeDefined();
  });

  it("fills the matched fields with the letter as edited, on a click only", () => {
    const props = renderWith(ready, contactForm);
    expect(props.onFill).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit your letter"), {
      target: { value: "Sehr geehrte Frau Weber, kurz." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    expect(props.onFill).toHaveBeenCalledExactlyOnceWith(
      [
        {
          key: "name:message",
          kind: "message",
          value: "Sehr geehrte Frau Weber, kurz.",
        },
        { key: "name:firstName", kind: "firstName", value: "Mara" },
        { key: "name:phone", kind: "phone", value: "030 5550123" },
      ],
      formKeys,
    );
  });

  it("lists no pairs to confirm on a known site", () => {
    renderWith(ready, contactForm);
    expect(screen.queryByRole("button", { name: /→/ })).toBeNull();
  });

  it("on an unknown site lists every pair and fills only those left on", () => {
    const props = renderWith(ready, contactForm, true);
    const pairs = screen.getAllByRole("button", { name: /→/ });
    expect(pairs.map((pair) => pair.textContent)).toEqual([
      `Nachricht → your letter (${countWords(passingLetter)} words)`,
      "Vorname → Mara",
      "Telefonnummer → 030 5550123",
    ]);
    for (const pair of pairs) {
      expect(pair.getAttribute("aria-pressed")).toBe("true");
    }

    fireEvent.click(screen.getByRole("button", { name: /^Vorname/ }));
    const off = screen.getByRole("button", { name: /^Vorname/ });
    expect(off.getAttribute("aria-pressed")).toBe("false");
    expect(off.textContent).toBe("Vorname → MaraLeft as it is");
    // The replaced-field line no longer names a field that stays as it is.
    expect(screen.queryByText(/Replaces what the page already has/)).toBeNull();

    expect(props.onFill).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    expect(props.onFill).toHaveBeenCalledExactlyOnceWith(
      [
        { key: "name:message", kind: "message", value: passingLetter },
        { key: "name:phone", kind: "phone", value: "030 5550123" },
      ],
      formKeys,
    );
  });

  it("can not fill once every pair is switched off", () => {
    renderWith(
      ready,
      {
        status: "form",
        fields: [field({ key: "name:vorname", label: "Vorname" })],
      },
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Vorname/ }));
    expect(
      screen.getByRole("button", { name: "Fill the form" }),
    ).toHaveProperty("disabled", true);
  });

  it("names the toolbar icon when an unknown site can no longer be read", () => {
    renderWith(ready, { status: "unreachable" }, true);
    expect(
      screen.getByText(/Click the Kiezpigeon icon in the toolbar/),
    ).toBeDefined();
  });

  it("forgets what you switched off when the page's form changes", () => {
    const view = (form: ContactFormState) => (
      <LetterReady
        state={ready}
        profile={coupleWithDog}
        listingTitle={undefined}
        form={form}
        confirmFirst
        onCheckForm={vi.fn()}
        onFill={vi.fn()}
        onTone={vi.fn()}
        onRewrite={vi.fn()}
        onBack={vi.fn()}
        onSent={vi.fn()}
      />
    );
    const { rerender } = render(view(contactForm));
    const vorname = () => screen.getByRole("button", { name: /^Vorname/ });
    fireEvent.click(vorname());
    expect(vorname().getAttribute("aria-pressed")).toBe("false");

    // Read again with the same fields: the choice stays.
    rerender(view({ ...contactForm }));
    expect(vorname().getAttribute("aria-pressed")).toBe("false");

    // The page gained a field: keys may now name other fields, so all on.
    rerender(
      view({
        status: "form",
        fields: [...contactFields, field({ key: "index:9", label: "Beruf" })],
      }),
    );
    expect(vorname().getAttribute("aria-pressed")).toBe("true");
  });

  it("says nothing was filled when the form changed since it was shown", () => {
    renderWith(ready, { ...contactForm, changed: true }, true);
    expect(
      screen.getByText(/The form on the page changed, so nothing was filled/),
    ).toBeDefined();
  });

  it("reports what the last fill did", () => {
    renderWith(ready, {
      ...contactForm,
      report: {
        filled: ["name:message", "name:firstName"],
        skipped: [{ key: "name:phone", reason: "missing" }],
      },
    });
    expect(
      screen.getByText("Filled 2 fields. Check them on the page."),
    ).toBeDefined();
    expect(screen.getByText("Could not fill: Telefonnummer.")).toBeDefined();
  });

  it("asks whether you sent it only after a fill, and saves the letter as filled", () => {
    const props = renderWith(ready, contactForm);
    expect(screen.queryByText("Did you send it?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit your letter"), {
      target: { value: "Sehr geehrte Frau Weber, kurz." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    props.rerender({ ...contactForm, report: filledReport });
    // Edits after the fill are not what the landlord got.
    fireEvent.change(screen.getByLabelText("Edit your letter"), {
      target: { value: "Changed after the fill." },
    });
    // Checking the form again drops the report; the question stays.
    props.rerender(contactForm);
    expect(screen.getByText("Did you send it?")).toBeDefined();
    expect(props.onSent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, I sent it" }));
    expect(props.onSent).toHaveBeenCalledExactlyOnceWith(
      "Sehr geehrte Frau Weber, kurz.",
    );
  });

  it("keeps the letter of the last fill that wrote, not of a later one that did not", () => {
    const props = renderWith(ready, contactForm);
    fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    props.rerender({ ...contactForm, report: filledReport });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit your letter"), {
      target: { value: "Sehr geehrte Frau Weber, kurz." },
    });
    // The second fill starts while the first fill's report is still shown,
    // then finds the form changed and writes nothing.
    fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    props.rerender({ ...contactForm, changed: true });
    fireEvent.click(screen.getByRole("button", { name: "Yes, I sent it" }));
    expect(props.onSent).toHaveBeenCalledExactlyOnceWith(passingLetter);
  });

  it("does not ask when the fill wrote nothing", () => {
    const props = renderWith(ready, contactForm);
    fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    props.rerender({ ...contactForm, changed: true });
    expect(screen.queryByText("Did you send it?")).toBeNull();
  });

  it("shows the listing is already in your pigeons instead of asking again", () => {
    const saved: Application = {
      id: "app_k3x9",
      listingUrl: kreuzbergListing.url,
      letter: passingLetter,
      status: "viewing",
      sentAt: "2027-02-01T09:30:00.000Z",
      statusChangedAt: "2027-02-03T09:30:00.000Z",
    };
    const props = renderWith(ready, contactForm, false, saved);
    fireEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    props.rerender({ ...contactForm, report: filledReport }, saved);
    expect(screen.getByText(/In your pigeons, marked Viewing/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Yes, I sent it" })).toBeNull();
    // Still exactly one teal button on the screen.
    expect(
      screen
        .getAllByRole("button")
        .filter((b) => b.className.includes("primary")),
    ).toHaveLength(1);
  });

  it("copies exactly the letter and leaves it unchanged", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    renderWith(ready);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(passingLetter);
    expect(
      await screen.findByText(
        "Copied. Paste it into the listing's message field.",
      ),
    ).toBeDefined();
    expect(screen.getByText(/^Sehr geehrte Frau Weber,/).textContent).toBe(
      passingLetter,
    );
  });

  it("re-checks the letter live while you edit it", () => {
    renderWith(ready);
    const edit = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(edit);
    expect(edit.getAttribute("aria-pressed")).toBe("true");
    const field = screen.getByLabelText("Edit your letter");
    // Typing must not make a screen reader read the checks every keystroke.
    expect(
      screen.getByText("150 words").parentElement?.getAttribute("aria-live"),
    ).toBe("off");
    const edited = "Sehr geehrte Frau Weber,\n\nwir zahlen 999 €.";
    const words = countWords(edited);
    fireEvent.change(field, { target: { value: edited } });
    expect(screen.getByText(`${words} words`)).toBeDefined();
    // No minimum length: only the number is a problem.
    expect(screen.queryByText(/it needs/)).toBeNull();
    expect(
      screen.getByText("The number 999 is not in the facts."),
    ).toBeDefined();
  });

  it("keeps the screen usable after a failed call", () => {
    const props = renderWith({
      status: "failed",
      request,
      message: "Claude is busy right now. Try again in a minute.",
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Claude is busy right now. Try again in a minute.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRewrite).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Short" }));
    expect(props.onTone).toHaveBeenCalledWith("short");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(props.onBack).toHaveBeenCalledOnce();
  });

  it("says it is writing while the letter is on its way", async () => {
    renderWith({ status: "writing", request });
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "Writing your letter",
      );
    });
  });
});
