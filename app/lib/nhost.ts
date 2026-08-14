import { createClient } from "@nhost/nhost-js";

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;

console.log("🔥 NHOST CONFIG");
console.log("Subdomain:", subdomain);
console.log("Region:", region);

export const nhost = createClient({
  subdomain: subdomain!,
  region: region!,
});