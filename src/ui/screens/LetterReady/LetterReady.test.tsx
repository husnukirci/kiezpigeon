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
import type { FormField } from "../../../rules/types";
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
const contactForm: ContactFormState = {
  status: "form",
  fields: [
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
  ],
};

function renderWith(
  state: Exclude<LetterState, { status: "idle" }>,
  form: ContactFormState = { status: "no_form" },
) {
  const props = {
    onTone: vi.fn(),
    onRewrite: vi.fn(),
    onBack: vi.fn(),
    onCheckForm: vi.fn(),
    onFill: vi.fn(),
  };
  render(
    <LetterReady
      state={state}
      profile={coupleWithDog}
      listingTitle={kreuzbergListing.title}
      form={form}
      {...props}
    />,
  );
  return props;
}

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
    expect(props.onFill).toHaveBeenCalledExactlyOnceWith([
      {
        key: "name:message",
        kind: "message",
        value: "Sehr geehrte Frau Weber, kurz.",
      },
      { key: "name:firstName", kind: "firstName", value: "Mara" },
      { key: "name:phone", kind: "phone", value: "030 5550123" },
    ]);
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
