// What a listing's free text says about the kind of rental (Phase 13).
import type { RentalHints } from "./types";

/** Every flag off: plain text that names no special form of rental. */
export const NO_HINTS: RentalHints = {
  sublet: false,
  interim: false,
  fixedTerm: false,
  furnished: false,
  sharedFlat: false,
  cooperative: false,
  wbs: false,
  firstOccupancy: false,
  staffel: false,
  index: false,
  commission: false,
  noViewing: false,
  paymentFirst: false,
  abroad: false,
};
