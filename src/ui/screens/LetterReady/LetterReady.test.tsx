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

function renderWith(state: Exclude<LetterState, { status: "idle" }>) {
  const props = { onTone: vi.fn(), onRewrite: vi.fn(), onBack: vi.fn() };
  render(
    <LetterReady
      state={state}
      listingTitle={kreuzbergListing.title}
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
    expect(
      screen.getByText(
        `The letter has ${words} words; it needs 120 to 180. Add about ${150 - words} words.`,
      ),
    ).toBeDefined();
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
