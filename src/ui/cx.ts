// Joins CSS module class names. Module lookups are `string | undefined`
// under noUncheckedIndexedAccess; missing ones are dropped.
export function cx(...names: (string | undefined | false)[]): string {
  return names.filter(Boolean).join(" ");
}
