/**
 * yooj.care, on Cloudflare: the built site, and the deck's server.
 *
 * yooj.care is the Cloudflare Worker "yooj-web-app" (wrangler.jsonc), built
 * from the DGKhan copy of this repository. Cloudflare serves the site's files;
 * this script answers the two requests the deck makes of a server - the gate
 * (/api/deck/access) and each slide (/api/deck/slide) - exactly as
 * api/deck/*.ts do on a Node host, with Cloudflare's Web Crypto in place of
 * node:crypto. Its passes and a Node host's are the same format under the same
 * key, so either can read the other's.
 *
 * The one difference: a Worker cannot redraw an image, so a slide leaves here
 * as it was sealed, marked `X-Slide-Stamped: 0`, and the viewer draws the
 * reader's address into it before it is shown (src/lib/deck-stamp.ts). The
 * mark is on every slide on screen, in every screenshot and in every image
 * saved from the page; only the browser's developer tools see the slide
 * before it.
 *
 * DECK_KEY is a secret on the Worker (Settings > Variables and Secrets). The
 * sealed slides are copied into the built site at /_sealed by the build
 * (vite.config.ts); they are ciphertext, and this script reads them through
 * the ASSETS binding and refuses them to anyone asking by address.
 *
 * The visits and sign-ups themselves never come here: the page sends them
 * straight to the Google Forms (src/lib/google-forms.ts).
 */

const PRIVATE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...PRIVATE },
  });

const text = new TextEncoder();

const toBase64Url = (bytes) => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Base64url to bytes; null if it is not base64url at all. */
const fromBase64Url = (value) => {
  try {
    const plain = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(plain + "=".repeat((4 - (plain.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ keys */

/**
 * The two keys drawn from DECK_KEY, as server/deck/keys.ts draws them:
 * HKDF-SHA256, salt "yooj/deck", info "seal" and "sign", 32 bytes each. They
 * have to match byte for byte - the slides were sealed with the first.
 */
let cached = null;

const deckKeys = async (env) => {
  const raw = (env.DECK_KEY ?? "").trim();
  if (!raw) return null;
  if (cached?.raw === raw) return cached.keys;

  const ikm = fromBase64Url(raw);
  if (!ikm || ikm.length < 32) return null;

  const base = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const derive = (info) =>
    crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: text.encode("yooj/deck"), info: text.encode(info) }, base, 256);
  const [seal, sign] = await Promise.all([derive("seal"), derive("sign")]);
  const keys = {
    seal: await crypto.subtle.importKey("raw", seal, "AES-GCM", false, ["decrypt"]),
    sign: await crypto.subtle.importKey("raw", sign, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]),
  };
  cached = { raw, keys };
  return keys;
};

/* ----------------------------------------------------------------- passes */

/** Twelve hours: one sitting with the deck (server/deck/token.ts). */
const LIFETIME_S = 12 * 60 * 60;

const issuePass = async (keys, email, now = Date.now()) => {
  const issued = Math.floor(now / 1000);
  const expires = issued + LIFETIME_S;
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(6)));
  const body = toBase64Url(text.encode(JSON.stringify({ e: email, i: issued, x: expires, n: nonce })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", keys.sign, text.encode(`v1.${body}`)));
  return { token: `v1.${body}.${toBase64Url(signature)}`, expires: expires * 1000 };
};

/** The pass behind a token, or null if it is forged, malformed or spent. */
const readPass = async (keys, token, now = Date.now()) => {
  if (!token) return null;
  const [version, body, signature] = token.split(".");
  if (version !== "v1" || !body || !signature) return null;

  const given = fromBase64Url(signature);
  if (!given) return null;
  const genuine = await crypto.subtle.verify("HMAC", keys.sign, given, text.encode(`v1.${body}`));
  if (!genuine) return null;

  try {
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (typeof claims.e !== "string" || typeof claims.i !== "number" || typeof claims.x !== "number") return null;
    if (claims.x * 1000 <= now) return null;
    return { email: claims.e, issued: claims.i * 1000, expires: claims.x * 1000 };
  } catch {
    return null;
  }
};

const bearer = (request) => /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;

/* ------------------------------------------------------------------ email */

/** An email address, tidied, or null - server/deck/email.ts, line for line. */
const normaliseEmail = (input) => {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;

  const at = email.lastIndexOf("@");
  if (at < 1 || at > 64) return null;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return null;
  }
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain)) return null;

  return email;
};

/* ------------------------------------------------------------ rate limit */

/** A speed bump per caller, in this isolate's memory (server/limit.ts). */
const hits = new Map();

const allow = (key, max, windowMs, now = Date.now()) => {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return true;
};

const clientIp = (request) => request.headers.get("cf-connecting-ip") ?? "unknown";

const log = (event, fields) => console.log(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));

/* ------------------------------------------------------------ the sealed deck */

/** A file from the built site's /_sealed, through the ASSETS binding. */
const sealedFile = (env, request, path) => env.ASSETS.fetch(new URL(`/_sealed/${path}`, request.url));

let manifest = null;

/** Null until a deck has been sealed and built in. Only a successful read is kept. */
const readManifest = async (env, request) => {
  if (manifest) return manifest;
  try {
    const res = await sealedFile(env, request, "manifest.json");
    // A missing file comes back as the site's own page (single-page fallback): not JSON.
    const parsed = res.ok ? await res.json() : null;
    if (parsed?.version !== 1 || !parsed.pages || !Array.isArray(parsed.sizes)) return null;
    manifest = parsed;
    return manifest;
  } catch {
    return null;
  }
};

const MAGIC = [0x59, 0x44, 0x4b, 0x31]; // "YDK1"

/**
 * One page as the WebP it was sealed from, or null. The file is
 * "YDK1" | iv (12) | GCM tag (16) | ciphertext, with `${page}@${width}` as
 * additional data (scripts/deck/seal.mjs); Web Crypto wants the tag after the
 * ciphertext.
 */
const openSlide = async (env, request, keys, page, width) => {
  const res = await sealedFile(env, request, `${width}/${String(page).padStart(2, "0")}.bin`);
  if (!res.ok) return null;
  const file = new Uint8Array(await res.arrayBuffer());
  if (file.length < 33 || MAGIC.some((b, i) => file[i] !== b)) return null;

  const sealed = new Uint8Array(file.length - 16);
  sealed.set(file.subarray(32), 0);
  sealed.set(file.subarray(16, 32), file.length - 32);
  try {
    const slide = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: file.subarray(4, 16), additionalData: text.encode(`${page}@${width}`), tagLength: 128 },
      keys.seal,
      sealed,
    );
    return new Uint8Array(slide);
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------- the routes */

/** POST /api/deck/access { email } - the gate: an address in, a signed pass out. */
const access = async (request, env) => {
  if (!allow(`deck-access:${clientIp(request)}`, 20, 10 * 60 * 1000)) return json(429, { error: "busy" });

  const keys = await deckKeys(env);
  const deck = await readManifest(env, request);
  if (!keys || !deck) return json(503, { error: "unavailable" });

  let body = null;
  try {
    body = await request.json();
  } catch {
    // Falls through to the address check, which reports it.
  }
  const email = normaliseEmail(body?.email);
  if (!email) return json(400, { error: "email" });

  const { token, expires } = await issuePass(keys, email);
  log("deck.access", { email, ip: clientIp(request), ua: request.headers.get("user-agent") ?? "" });

  return json(200, { token, expires, email, title: deck.title, pages: deck.pages, ratio: deck.ratio });
};

/** GET /api/deck/slide?page=3&w=2400 (Authorization: Bearer <pass>) - one page, opened from its seal. */
const slide = async (request, env) => {
  const keys = await deckKeys(env);
  const pass = keys ? await readPass(keys, bearer(request)) : null;
  if (!pass) return json(401, { error: "pass" });

  const deck = await readManifest(env, request);
  if (!deck) return json(503, { error: "unavailable" });

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page"));
  if (!Number.isInteger(page) || page < 1 || page > deck.pages) return json(404, { error: "page" });

  // The nearest sealed width at or above the one asked for, else the largest.
  const asked = Number(url.searchParams.get("w")) || 0;
  const widths = [...deck.sizes].sort((a, b) => a.w - b.w);
  const size = widths.find((s) => s.w >= asked) ?? widths[widths.length - 1];

  const image = await openSlide(env, request, keys, page, size.w);
  if (!image) return json(503, { error: "unavailable" });

  log("deck.view", { email: pass.email, page, w: size.w, ip: clientIp(request) });
  return new Response(image, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(image.length),
      "X-Slide-Width": String(size.w),
      // Not yet stamped: the viewer draws the reader's address in before showing it.
      "X-Slide-Stamped": "0",
      ...PRIVATE,
    },
  });
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/deck/access") return request.method === "POST" ? access(request, env) : json(405, { error: "method" });
    if (pathname === "/api/deck/slide") return request.method === "GET" ? slide(request, env) : json(405, { error: "method" });
    if (pathname.startsWith("/api/")) return json(404, { error: "not found" });
    // Only this script reads the sealed deck, through ASSETS; nobody fetches it by address.
    if (pathname.startsWith("/_sealed/")) return new Response("Not found", { status: 404, headers: PRIVATE });

    return env.ASSETS.fetch(request);
  },
};
