// A stored value as React state, kept current by storage change events from
// any extension context (ADR 3). Screens never call storage reads directly.
import { useEffect, useState } from "react";
import {
  read,
  subscribe,
  type StoredData,
  type StoredKey,
} from "../../storage/storage";

export type Stored<T> =
  | { status: "loading" }
  | { status: "ready"; value: T | undefined }
  | { status: "invalid"; problems: string[] };

export function useStored<K extends StoredKey>(key: K): Stored<StoredData[K]> {
  const [state, setState] = useState<Stored<StoredData[K]>>({
    status: "loading",
  });

  useEffect(() => {
    let live = true;
    const load = (): void => {
      read(key).then(
        (result) => {
          if (!live) return;
          setState(
            result.ok
              ? { status: "ready", value: result.value }
              : { status: "invalid", problems: result.problems },
          );
        },
        (error: unknown) => {
          if (live) setState({ status: "invalid", problems: [String(error)] });
        },
      );
    };
    load();
    const unsubscribe = subscribe(key, load);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [key]);

  return state;
}
