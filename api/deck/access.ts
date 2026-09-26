import { normaliseEmail } from "../../server/deck/email.js";
import { clientIp, json, log } from "../../server/http.js";
import { deckKeys } from "../../server/deck/keys.js";
import { allow } from "../../server/limit.js";
import { readManifest } from "../../server/deck/sealed.js";
import { issuePass } from "../../server/deck/token.js";

/**
 * POST /api/deck/access  { email }
 *
 * The gate. An address in, a signed pass out - and with it everything the
 * viewer needs to lay the deck out before the first slide arrives.
 *
 * The visit is written to the admin's sheet by /api/deck/seen, which the page
 * calls once it is in, so this answer never waits on Google.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!allow(`deck-access:${ip}`, 20, 10 * 60 * 1000)) return json(429, { error: "busy" });

  const manifest = await readManifest();
  if (!deckKeys() || !manifest) return json(503, { error: "unavailable" });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Falls through to the address check, which reports it.
  }
  const email = normaliseEmail((body as { email?: unknown } | null)?.email);
  if (!email) return json(400, { error: "email" });

  const { token, expires } = issuePass(email);
  log("deck.access", { email, ip, ua: request.headers.get("user-agent") ?? "" });

  return json(200, {
    token,
    expires,
    email,
    title: manifest.title,
    pages: manifest.pages,
    ratio: manifest.ratio,
  });
}
