import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

afterEach(cleanup);

const options = [
  { value: "warm", label: "Warm" },
  { value: "formal", label: "Formal" },
] as const;

describe("SegmentedControl", () => {
  it("does not report the option that is already selected", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Tone"
        options={options}
        value="warm"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Warm" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Formal" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("formal");
  });
});
