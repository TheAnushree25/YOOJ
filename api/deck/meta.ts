import { bearer, json } from "../../server/deck/http.js";
import { readManifest } from "../../server/deck/sealed.js";
import { readPass } from "../../server/deck/token.js";

/**
 * GET /api/deck/meta  (Authorization: Bearer <pass>)
 *
 * A returning reader: is the pass they kept still good, and whose is it.
 */
export async function GET(request: Request) {
  const pass = readPass(bearer(request));
  if (!pass) return json(401, { error: "pass" });

  const manifest = await readManifest();
  if (!manifest) return json(503, { error: "unavailable" });

  return json(200, {
    email: pass.email,
    expires: pass.expires,
    title: manifest.title,
    pages: manifest.pages,
    ratio: manifest.ratio,
  });
}
