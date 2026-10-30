import { beforeEach, describe, expect, it, vi } from "vitest";
import { browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { coupleWithDog } from "../../test-support/sample-profiles";
import {
  addApplication,
  changeApplication,
  clearAll,
  migrate,
  MIGRATIONS,
  read,
  remove,
  resetForTests,
  SCHEMA_VERSION,
  subscribe,
  write,
  writeAll,
} from "./storage";

const application = {
  id: "app_test1",
  listingUrl: "https://www.immobilienscout24.de/expose/000000001",
  letter: "Sehr geehrte Frau Beispiel, ...",
  status: "sent" as const,
  sentAt: "2027-01-10T09:00:00.000Z",
  statusChangedAt: "2027-01-10T09:00:00.000Z",
};

beforeEach(() => {
  fakeBrowser.reset();
  resetForTests();
});

describe("read and write", () => {
  it("round-trips a profile and stamps the schema version", async () => {
    await write("profile", coupleWithDog);
    expect(await read("profile")).toEqual({ ok: true, value: coupleWithDog });
    expect(await browser.storage.local.get("schemaVersion")).toEqual({
      schemaVersion: SCHEMA_VERSION,
    });
  });

  it("round-trips settings and a trimmed api key, and removes the key", async () => {
    await writeAll({
      settings: { model: "claude-haiku-5-5" },
      apiKey: " FAKE-KEY-1 ",
    });
    expect(await read("settings")).toEqual({
      ok: true,
      value: { model: "claude-haiku-5-5" },
    });
    expect(await read("apiKey")).toEqual({ ok: true, value: "FAKE-KEY-1" });
    await remove("apiKey");
    expect(await read("apiKey")).toEqual({ ok: true, value: undefined });
    expect(await read("settings")).toEqual({
      ok: true,
      value: { model: "claude-haiku-5-5" },
    });
  });

  it("reads nothing stored as an undefined value, not a problem", async () => {
    expect(await read("profile")).toEqual({ ok: true, value: undefined });
  });

  it("names every problem of a damaged stored value instead of returning it", async () => {
    await browser.storage.local.set({
      schemaVersion: 1,
      applications: [application, { ...application, status: "won" }],
    });
    const result = await read("applications");
    expect(result).toEqual({
      ok: false,
      problems: [
        "applications[1].status: must be one of sent, viewing, closed",
      ],
    });
  });

  it("refuses to write an invalid value and leaves storage untouched", async () => {
    const bad = { ...coupleWithDog, applicants: [] };
    await expect(write("profile", bad)).rejects.toThrow(
      "applicants: must have 1 or 2 entries",
    );
    expect(await browser.storage.local.get(null)).toEqual({});
  });

  it("stores only known keys, so nothing extra rides along", async () => {
    await write("profile", { ...coupleWithDog, apiKey: "FAKE-KEY" } as never);
    const stored = await browser.storage.local.get("profile");
    expect(JSON.stringify(stored)).not.toContain("FAKE-KEY");
  });

  it("writes several keys at once", async () => {
    await writeAll({ profile: coupleWithDog, applications: [application] });
    expect(await read("applications")).toEqual({
      ok: true,
      value: [application],
    });
  });
});

describe("writeAll with extra keys", () => {
  it("ignores keys it does not know instead of failing", async () => {
    await writeAll({ profile: coupleWithDog, step: "confirm" } as never);
    expect(await browser.storage.local.get(null)).toEqual({
      schemaVersion: SCHEMA_VERSION,
      profile: coupleWithDog,
    });
  });
});

describe("applications", () => {
  it("adds applications one by one and changes one by id", async () => {
    const second = { ...application, id: "app_test2" };
    await addApplication(application);
    await addApplication(second);
    await changeApplication("app_test2", (a) => ({ ...a, status: "closed" }));
    expect(await read("applications")).toEqual({
      ok: true,
      value: [application, { ...second, status: "closed" }],
    });
  });

  it("refuses to add to a damaged list instead of overwriting it", async () => {
    const damaged = [{ ...application, status: "ghosted" }];
    await browser.storage.local.set({ applications: damaged });
    await expect(addApplication(application)).rejects.toThrow(
      "applications[0].status",
    );
    expect(await browser.storage.local.get("applications")).toEqual({
      applications: damaged,
    });
  });
});

describe("clearAll", () => {
  it("leaves storage completely empty", async () => {
    await writeAll({ profile: coupleWithDog, applications: [application] });
    await browser.storage.local.set({ apiKey: "FAKE-KEY" });
    await clearAll();
    expect(await browser.storage.local.get(null)).toEqual({});
  });
});

describe("migrate", () => {
  it("migrates a schema 1 profile's move-in date", async () => {
    const v1: Record<string, unknown> = { ...coupleWithDog };
    delete v1.moveIn;
    await browser.storage.local.set({
      schemaVersion: 1,
      profile: { ...v1, moveInDate: "2027-03-01" },
    });
    const read1 = await read("profile");
    expect(read1.ok && read1.value?.moveIn).toEqual({
      kind: "date",
      date: "2027-03-01",
    });
    expect(await browser.storage.local.get("schemaVersion")).toEqual({
      schemaVersion: 2,
    });
  });

  it("migrates a schema 1 store that has a key but no profile yet", async () => {
    // The step itself must not add a profile key, whatever storage does
    // with an undefined value.
    expect(MIGRATIONS[1]?.({ apiKey: "FAKE-KEY" })).toEqual({
      apiKey: "FAKE-KEY",
    });
    expect(Object.keys(MIGRATIONS[1]?.({ apiKey: "FAKE-KEY" }) ?? {})).toEqual([
      "apiKey",
    ]);
    await browser.storage.local.set({ schemaVersion: 1, apiKey: "FAKE-KEY" });
    await migrate();
    expect(await browser.storage.local.get(null)).toEqual({
      schemaVersion: 2,
      apiKey: "FAKE-KEY",
    });
  });

  it("does nothing to an empty store", async () => {
    await migrate();
    expect(await browser.storage.local.get(null)).toEqual({});
  });

  it("runs the migration from each older version and stamps the new one", async () => {
    await browser.storage.local.set({ schemaVersion: 0, profile: "old" });
    await migrate({
      0: (data) => ({ ...data, profile: "migrated" }),
      1: (data) => data,
    });
    expect(await browser.storage.local.get(null)).toEqual({
      schemaVersion: SCHEMA_VERSION,
      profile: "migrated",
    });
  });

  it("refuses data from a newer version and does not rewrite it", async () => {
    await browser.storage.local.set({ schemaVersion: SCHEMA_VERSION + 1 });
    await expect(migrate()).rejects.toThrow("newer Kiezpigeon");
    expect(await browser.storage.local.get(null)).toEqual({
      schemaVersion: SCHEMA_VERSION + 1,
    });
  });
});

describe("subscribe", () => {
  it("calls back when its key changes and stops after unsubscribing", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribe("profile", listener);
    await write("profile", coupleWithDog);
    await browser.storage.local.set({ applications: [] });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    await clearAll();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
