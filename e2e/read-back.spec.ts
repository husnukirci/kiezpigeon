// The premise of the fill read-back (src/fill/fill.ts): Chromium's native
// value setter drops a value a number or date input cannot hold (and trims an
// email or url, which loses nothing), so reading the field back tells a
// refused write from a kept one. happy-dom does not sanitise, so the unit
// test stubs this; here the real browser shows it.
import { expect, test } from "@playwright/test";

test("a number or date input drops a value it cannot hold", async ({
  page,
}) => {
  await page.setContent(
    '<form><input id="n" type="number"><input id="d" type="date"></form>',
  );
  const read = await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    const write = (id: string, value: string): string => {
      const input = document.getElementById(id) as HTMLInputElement;
      descriptor?.set?.call(input, value);
      return input.value;
    };
    return {
      badNumber: write("n", "viertausend"),
      goodNumber: write("n", "4600"),
      badDate: write("d", "01.03.2027"),
      goodDate: write("d", "2027-03-01"),
    };
  });
  expect(read).toEqual({
    badNumber: "",
    goodNumber: "4600",
    badDate: "",
    goodDate: "2027-03-01",
  });
});

test("an email or url input trims the spaces around a value", async ({
  page,
}) => {
  await page.setContent(
    '<form><input id="e" type="email"><input id="u" type="url"></form>',
  );
  const read = await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    const write = (id: string, value: string): string => {
      const input = document.getElementById(id) as HTMLInputElement;
      descriptor?.set?.call(input, value);
      return input.value;
    };
    return {
      email: write("e", " mara@example.test "),
      url: write("u", " https://example.test/ "),
    };
  });
  expect(read).toEqual({
    email: "mara@example.test",
    url: "https://example.test/",
  });
});
