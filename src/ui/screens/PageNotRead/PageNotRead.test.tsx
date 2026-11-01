import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { soloStudent } from "../../../../test-support/sample-profiles";
import { PageNotRead } from "./PageNotRead";

describe("PageNotRead", () => {
  it("names the site whose page is not a listing", () => {
    render(
      <PageNotRead
        page={{ reason: "not_listing", siteName: "Vonovia" }}
        profile={soloStudent}
      />,
    );
    expect(
      screen.getByText(
        "This Vonovia page is not a listing. Open a listing to start.",
      ),
    ).toBeTruthy();
  });
});
