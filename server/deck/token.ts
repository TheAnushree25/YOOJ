import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { deckKeys } from "./keys.js";

/**
 * A reader's pass: the email they gave at the gate, signed.
 *
 * Stateless on purpose - there is no database behind the deck, and a pass has
 * to be checked on every slide. The email inside it is the one stamped into
 * every page that reader is sent, and the signature is what stops anyone
 * changing it to somebody else's.
 */
export interface Pass {
  email: string;
  issued: number;
  expires: number;
}

/** Thirty days: long enough to come back to, short enough to lapse. */
const LIFETIME_S = 30 * 24 * 60 * 60;

const sign = (key: Buffer, body: string) => createHmac("sha256", key).update(`v1.${body}`).digest();

export const issuePass = (email: string, now = Date.now()) => {
  const keys = deckKeys();
  if (!keys) throw new Error("DECK_KEY is not configured");

  const issued = Math.floor(now / 1000);
  const expires = issued + LIFETIME_S;
  // `n` only makes two passes for the same reader in the same second differ.
  const body = Buffer.from(
    JSON.stringify({ e: email, i: issued, x: expires, n: randomBytes(6).toString("base64url") }),
  ).toString("base64url");

  return {
    token: `v1.${body}.${sign(keys.sign, body).toString("base64url")}`,
    expires: expires * 1000,
  };
};

/** The pass behind a token, or null if it is forged, malformed or spent. */
export const readPass = (token: string | null | undefined, now = Date.now()): Pass | null => {
  const keys = deckKeys();
  if (!keys || !token) return null;

  const [version, body, signature] = token.split(".");
  if (version !== "v1" || !body || !signature) return null;

  const expected = sign(keys.sign, body);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof claims.e !== "string" || typeof claims.i !== "number" || typeof claims.x !== "number") return null;
    if (claims.x * 1000 <= now) return null;
    return { email: claims.e, issued: claims.i * 1000, expires: claims.x * 1000 };
  } catch {
    return null;
  }
};
