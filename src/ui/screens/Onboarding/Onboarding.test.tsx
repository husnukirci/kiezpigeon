import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { read, resetForTests } from "../../../storage/storage";
import { Onboarding } from "./Onboarding";

beforeEach(() => {
  fakeBrowser.reset();
  resetForTests();
});
afterEach(cleanup);

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function next(): void {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("Onboarding", () => {
  it("walks the five steps and stores the profile only at the end", async () => {
    const { container } = render(<Onboarding />);
    expect(screen.getByRole("heading", { name: "About you" })).toBeDefined();

    next();
    expect(screen.getByText("Add a first name")).toBeDefined();
    expect(
      screen.getByLabelText("First name").getAttribute("aria-invalid"),
    ).toBe("true");

    type("First name", "Pia");
    type("Last name", "Musterfrau");
    type("Net monthly income (€)", "1.850,50");
    next();
    expect(
      screen.getByRole("heading", { name: "Your household" }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "More children" }));
    fireEvent.click(screen.getByRole("button", { name: "Pets" }));
    type("Email", "pia@example.org");
    type("Max Warmmiete (€)", "1.100");
    next();

    fireEvent.click(screen.getByRole("button", { name: "SCHUFA" }));
    expect(
      screen
        .getByRole("button", { name: "SCHUFA" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    next();

    fireEvent.click(screen.getByRole("button", { name: "Formal" }));
    next();

    // Connecting Claude is offered, and can be left for later.
    expect(
      screen.getByRole("heading", { name: "Connect Claude" }),
    ).toBeDefined();
    expect(await screen.findByLabelText("API key")).toBeDefined();
    expect(await read("profile")).toEqual({ ok: true, value: undefined });
    next();

    await waitFor(async () => {
      const stored = await read("profile");
      expect(stored.ok && stored.value).toMatchObject({
        applicants: [
          { firstName: "Pia", lastName: "Musterfrau", netIncomeCents: 185050 },
        ],
        household: {
          adults: 1,
          children: 1,
          pets: [{ kind: "dog", count: 1 }],
        },
        contact: { email: "pia@example.org" },
        budgetWarmCents: 110000,
        letterDefaults: { tone: "formal", language: "de" },
        documents: { schufa: "ready", id: "pending" },
      });
    });
    // Documents are flags: no step ever offers a file input.
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it("stores how two applicants are related and when they can move in", async () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByRole("button", { name: "Add co-applicant" }));
    const fill = (label: string, values: string[]): void => {
      screen.getAllByLabelText(label).forEach((field, i) => {
        fireEvent.change(field, { target: { value: values[i] } });
      });
    };
    fill("First name", ["Mara", "Jonas"]);
    fill("Last name", ["Testmann", "Beispiel"]);
    fill("Net monthly income (€)", ["2.600", "2.000"]);
    fireEvent.change(screen.getByLabelText("You are"), {
      target: { value: "married" },
    });
    next();

    fireEvent.click(
      screen.getByRole("button", { name: "As soon as possible" }),
    );
    expect(screen.queryByLabelText("Move-in date")).toBeNull();
    type("Email", "mara.testmann@example.org");
    next();
    next();
    next();
    next();

    await waitFor(async () => {
      const stored = await read("profile");
      expect(stored.ok && stored.value).toMatchObject({
        household: { relationship: "married" },
        moveIn: { kind: "asap" },
      });
    });
  });

  it("adds a co-applicant and counts them as an adult", () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByRole("button", { name: "Add co-applicant" }));
    expect(screen.getByRole("heading", { name: "Co-applicant" })).toBeDefined();
    expect(screen.getAllByLabelText("First name")).toHaveLength(2);
  });
});
