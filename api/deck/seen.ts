import { bearer, json } from "../../server/http.js";
import { submitForm } from "../../server/forms.js";
import { readPass } from "../../server/deck/token.js";
import { deviceOf, placeOf } from "../../server/visitor.js";

/**
 * POST /api/deck/seen  (Authorization: Bearer <pass>)
 *
 * The admin's record of a visit: the address given at the gate, sent to the
 * deck's Google Form - and so into the sheet it is linked to - with the city
 * and the device. Google stamps the time.
 *
 * Its own request, sent by the page the moment the gate lets the reader in,
 * rather than part of the gate's: the gate answers at once and the deck opens,
 * while this one waits on Google for as long as Google takes. The pass is the
 * proof that the address really came through the gate.
 */

/** Passes already recorded by this instance, so a pass writes one row. */
const recorded = new Set<string>();

/** Only a pass this fresh is recorded: an old one replayed is not a new visit. */
const FRESH_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const token = bearer(request);
  const pass = readPass(token);
  if (!token || !pass) return json(401, { error: "pass" });

  if (recorded.has(token) || Date.now() - pass.issued > FRESH_MS) {
    return json(200, { ok: true, recorded: false });
  }
  recorded.add(token);
  if (recorded.size > 2000) recorded.delete(recorded.values().next().value as string);

  const ok = await submitForm("deck", {
    Email: pass.email,
    Location: placeOf(request),
    Device: deviceOf(request.headers.get("user-agent")),
  });
  // Not written: forget it, so the page's one retry can try again.
  if (!ok) recorded.delete(token);
  return json(ok ? 200 : 502, { ok, recorded: ok });
}
