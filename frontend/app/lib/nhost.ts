import { createClient } from "@nhost/nhost-js";

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;

if (!subdomain || !region) {
  throw new Error(
    "Missing NEXT_PUBLIC_NHOST_SUBDOMAIN or NEXT_PUBLIC_NHOST_REGION"
  );
}

export const nhost = createClient({
  subdomain,
  region,
});
