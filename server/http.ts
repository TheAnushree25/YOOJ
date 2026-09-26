import { BlockList, isIP } from "node:net";

/**
 * What every response from the site's functions carries.
 *
 * Nothing they send may be cached anywhere but the reader's own tab: a deck
 * slide is stamped for one person, and a shared cache that kept it would hand
 * that person's copy to the next.
 */
export const PRIVATE: Record<string, string> = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...PRIVATE },
  });

/** The pass, from `Authorization: Bearer ...` - never from the URL, where it would end up in logs and history. */
export const bearer = (request: Request) => {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
};

export const clientIp = (request: Request) => {
  if (viaCloudflare(request)) {
    const visitor = request.headers.get("x-yooj-client-ip")?.trim();
    if (visitor && isIP(visitor)) return visitor;
  }
  return connecting(request) || "unknown";
};

/** The address this request actually arrived from, as the host reports it. */
const connecting = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || request.headers.get("x-real-ip")?.trim()
  || "";

/**
 * Cloudflare's own addresses (cloudflare.com/ips-v4, /ips-v6). yooj.care is
 * served by Cloudflare, whose function (functions/api/[[path]].js) hands
 * /api/* on to these functions and names the visitor in x-yooj-* headers.
 * Those are believed only on a request that really comes from Cloudflare, so
 * nobody sending the headers straight here picks their own rate-limit address.
 */
const CLOUDFLARE = new BlockList();
for (const range of [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
  "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
]) {
  const [address, prefix] = range.split("/");
  CLOUDFLARE.addSubnet(address, Number(prefix), address.includes(":") ? "ipv6" : "ipv4");
}

/** Whether yooj.care's forwarder on Cloudflare handed this request on. */
export const viaCloudflare = (request: Request) => {
  const from = connecting(request);
  const family = isIP(from);
  return family !== 0 && CLOUDFLARE.check(from, family === 6 ? "ipv6" : "ipv4");
};

/**
 * One line per event, as JSON, into the host's function logs.
 *
 * The technical trail - which pages of the deck were read, what Google
 * refused. The admin's own record of visits and sign-ups is the Google Forms'
 * sheets (server/forms.ts); this lives only as long as the host keeps its logs.
 */
export const log = (event: string, fields: Record<string, unknown>) => {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
};
