// Vonovia listing pages, on the platform it shares with Deutsche Wohnen.
import { estatePlatformAdapter } from "../estatePlatform";

export const vonovia = estatePlatformAdapter({
  id: "vonovia",
  siteName: "Vonovia",
  // A slug that ends in the object id: `helle-wohnung-82-1000000001`.
  listingUrl:
    /^https:\/\/www\.vonovia\.de\/zuhause-finden\/immobilien\/[^/?#]*\d+-\d+\/?(?:[?#]|$)/,
});
