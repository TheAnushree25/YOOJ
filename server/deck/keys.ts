import { hkdfSync } from "node:crypto";

/**
 * The deck's two keys, drawn from one secret.
 *
 * DECK_KEY is the only thing that has to be configured: one to open the
 * sealed slides, one to sign the passes readers are given at the gate. They
 * are derived rather than stored side by side, so there is exactly one value
 * to keep out of the repository and one to rotate. The derivation has to
 * match scripts/deck/seal.mjs byte for byte - the slides were sealed with it.
 */
export interface DeckKeys {
  seal: Buffer;
  sign: Buffer;
}

let cached: { raw: string; keys: DeckKeys } | null = null;

/** Null when the deck has not been configured on this host. */
export const deckKeys = (): DeckKeys | null => {
  const raw = process.env.DECK_KEY?.trim();
  if (!raw) return null;
  if (cached?.raw === raw) return cached.keys;

  const ikm = Buffer.from(raw, "base64url");
  if (ikm.length < 32) return null;

  const derive = (info: string) => Buffer.from(hkdfSync("sha256", ikm, "yooj/deck", info, 32));
  cached = { raw, keys: { seal: derive("seal"), sign: derive("sign") } };
  return cached.keys;
};
