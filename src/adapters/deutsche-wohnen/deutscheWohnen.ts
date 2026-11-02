// Deutsche Wohnen listing pages, on the platform it shares with Vonovia.
import { estatePlatformAdapter } from "../estatePlatform";

export const deutscheWohnen = estatePlatformAdapter({
  id: "deutsche-wohnen",
  siteName: "Deutsche Wohnen",
  // A slug that ends in the object id: `ruhige-wohnung-89-2000000001`.
  listingUrl:
    /^https:\/\/www\.deutsche-wohnen\.com\/mieten\/mietangebote\/[^/?#]*\d+-\d+\/?(?:[?#]|$)/,
});
