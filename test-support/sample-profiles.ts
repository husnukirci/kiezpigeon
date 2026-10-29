// Invented people and an invented listing. Every test and screenshot uses
// these; no value here belongs to a real person, flat or landlord.
import type { Listing, Profile } from "../src/rules/types";

/** Two earners, a dog, everything ready. The strong case. */
export const coupleWithDog: Profile = {
  applicants: [
    {
      id: "a1",
      firstName: "Mara",
      lastName: "Testmann",
      job: "Softwareentwicklerin",
      employment: "permanent",
      netIncomeCents: 260000,
    },
    {
      id: "a2",
      firstName: "Jonas",
      lastName: "Beispiel",
      job: "Lehrer",
      employment: "civil_servant",
      netIncomeCents: 200000,
    },
  ],
  household: {
    adults: 2,
    children: 0,
    pets: [{ kind: "dog", count: 1 }],
    smoker: false,
  },
  moveIn: { kind: "date", date: "2027-03-01" },
  contact: {
    email: "mara.testmann@example.org",
    phone: "030 5550123",
    street: "Erfundene Straße",
    houseNumber: "7",
    postcode: "10999",
    city: "Berlin",
  },
  budgetWarmCents: 130000,
  hasWbs: false,
  letterDefaults: { tone: "warm", language: "de" },
  documents: {
    schufa: "ready",
    mietschuldenfreiheit: "ready",
    incomeProof: "ready",
    id: "ready",
    wbs: "pending",
  },
};

/** One student, no pets, no budget set yet, documents pending. */
export const soloStudent: Profile = {
  applicants: [
    {
      id: "a1",
      firstName: "Pia",
      lastName: "Musterfrau",
      job: "Studentin",
      employment: "student",
      netIncomeCents: 95000,
    },
  ],
  household: { adults: 1, children: 0, pets: [], smoker: false },
  contact: {
    email: "pia@example.org",
    phone: "0151 55500000",
    street: "Ausgedachter Weg",
    houseNumber: "12a",
    postcode: "12043",
    city: "Berlin",
  },
  hasWbs: true,
  letterDefaults: { tone: "short", language: "de" },
  documents: {
    schufa: "pending",
    mietschuldenfreiheit: "pending",
    incomeProof: "ready",
    id: "ready",
    wbs: "ready",
  },
};

/** A complete listing as the ImmoScout24 adapter would return it. */
export const kreuzbergListing: Listing = {
  url: "https://www.immobilienscout24.de/expose/100000001",
  title: "Helle 2-Zimmer-Altbauwohnung mit Balkon",
  district: "Kreuzberg",
  kaltmieteCents: 118000,
  nebenkostenCents: 22000,
  warmmieteCents: 140000,
  areaM2: 62,
  rooms: 2,
  floor: 3,
  availability: { kind: "date", date: "2027-03-01" },
  yearBuilt: 1905,
  petPolicy: "by_arrangement",
  wbsRequired: false,
  contactPerson: { salutation: "Frau", lastName: "Weber" },
  features: ["Balkon", "Altbau", "Einbauküche"],
  missing: [],
};

/** A listing page that shows almost nothing. */
export const sparseListing: Listing = {
  url: "https://www.immobilienscout24.de/expose/100000002",
  features: [],
  missing: [
    "kaltmieteCents",
    "nebenkostenCents",
    "warmmieteCents",
    "petPolicy",
    "wbsRequired",
    "contactPerson",
  ],
};
