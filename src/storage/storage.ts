// The one module that touches extension storage (ADR 3). Everything lives
// in `storage.local`; every read is validated by the rules core, so a
// damaged or hand-edited value never reaches a screen as if it were fine.
import { browser } from "wxt/browser";
import { parseApplication, parseProfile, type Parsed } from "../rules/profile";
import type { Application, Profile } from "../rules/types";

export const SCHEMA_VERSION = 1;

/** The validated values, by storage key. */
export interface StoredData {
  profile: Profile;
  applications: Application[];
}

export type StoredKey = keyof StoredData;

/** `value` is undefined when nothing is stored under the key yet. */
export type ReadResult<T> =
  { ok: true; value: T | undefined } | { ok: false; problems: string[] };

type Raw = Record<string, unknown>;

/** Turns data stored at version `n` into data at version `n + 1`. */
export type Migration = (data: Raw) => Raw;

/** Keyed by the version they upgrade from. None yet. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

const PARSERS: { [K in StoredKey]: (input: unknown) => Parsed<StoredData[K]> } =
  {
    profile: parseProfile,
    applications: parseApplications,
  };

function parseApplications(input: unknown): Parsed<Application[]> {
  if (!Array.isArray(input)) {
    return { ok: false, problems: ["applications: must be a list"] };
  }
  const problems: string[] = [];
  const value: Application[] = [];
  input.forEach((item, i) => {
    const parsed = parseApplication(item);
    if (parsed.ok) value.push(parsed.value);
    else
      problems.push(...parsed.problems.map((p) => `applications[${i}].${p}`));
  });
  return problems.length === 0 ? { ok: true, value } : { ok: false, problems };
}

/**
 * Brings stored data up to `SCHEMA_VERSION`. Data with no version is
 * either an empty store or was written at version 1, the first one. Data
 * from a newer version is left alone: a downgrade must not rewrite it.
 */
export async function migrate(
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Promise<void> {
  let data: Raw = await browser.storage.local.get(null);
  const stored = data.schemaVersion;
  if (stored === undefined) return;
  if (typeof stored !== "number" || !Number.isInteger(stored)) {
    throw new Error(
      `Stored schemaVersion is not a version: ${JSON.stringify(stored)}`,
    );
  }
  if (stored > SCHEMA_VERSION) {
    throw new Error(
      `Stored data is from a newer Kiezpigeon (schema ${stored}, this is ${SCHEMA_VERSION})`,
    );
  }
  if (stored === SCHEMA_VERSION) return;
  for (let version = stored; version < SCHEMA_VERSION; version++) {
    const step = migrations[version];
    if (!step) throw new Error(`No migration from schema ${version}`);
    data = step(data);
  }
  await browser.storage.local.set({ ...data, schemaVersion: SCHEMA_VERSION });
}

// Each extension context (panel, service worker) migrates once, before its
// first read or write.
let migrated: Promise<void> | undefined;
function ready(): Promise<void> {
  migrated ??= migrate();
  return migrated;
}

/** For tests: forget that this context already migrated. */
export function resetForTests(): void {
  migrated = undefined;
}

export async function read<K extends StoredKey>(
  key: K,
): Promise<ReadResult<StoredData[K]>> {
  await ready();
  const raw: unknown = (await browser.storage.local.get(key))[key];
  if (raw === undefined) return { ok: true, value: undefined };
  return PARSERS[key](raw);
}

/**
 * Validates before writing, so storage only ever holds what a read will
 * accept. Throws on an invalid value: callers validate first and show the
 * problems themselves.
 */
export async function write<K extends StoredKey>(
  key: K,
  value: StoredData[K],
): Promise<void> {
  await writeAll({ [key]: value });
}

/** Writes several keys in one storage call, e.g. an import. */
export async function writeAll(values: Partial<StoredData>): Promise<void> {
  await ready();
  const clean: Raw = { schemaVersion: SCHEMA_VERSION };
  for (const key of Object.keys(values) as StoredKey[]) {
    const parsed = PARSERS[key](values[key]);
    if (!parsed.ok) {
      throw new Error(
        `Refusing to store an invalid ${key}: ${parsed.problems.join("; ")}`,
      );
    }
    clean[key] = parsed.value;
  }
  await browser.storage.local.set(clean);
}

/** "Delete all data": one call, nothing left behind, not even the version. */
export async function clearAll(): Promise<void> {
  await browser.storage.local.clear();
}

/** Calls `listener` whenever `key` changes in any extension context. */
export function subscribe(key: StoredKey, listener: () => void): () => void {
  const onChanged = (changes: Record<string, unknown>, area: string): void => {
    if (area === "local" && key in changes) listener();
  };
  browser.storage.onChanged.addListener(onChanged);
  return () => {
    browser.storage.onChanged.removeListener(onChanged);
  };
}
