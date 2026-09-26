import { PRIVATE, bearer, clientIp, json, log } from "../../server/http.js";
import { openSlide, readManifest } from "../../server/deck/sealed.js";
import { readPass } from "../../server/deck/token.js";
import { stamp } from "../../server/deck/watermark.js";

/**
 * GET /api/deck/slide?page=3&w=2400  (Authorization: Bearer <pass>)
 *
 * One page, opened from its seal and stamped with the reader's address on the
 * way out. The unstamped slide exists only in this function's memory.
 */
export async function GET(request: Request) {
  const pass = readPass(bearer(request));
  if (!pass) return json(401, { error: "pass" });

  const manifest = await readManifest();
  if (!manifest) return json(503, { error: "unavailable" });

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page"));
  if (!Number.isInteger(page) || page < 1 || page > manifest.pages) return json(404, { error: "page" });

  // The nearest sealed width at or above the one asked for, else the largest.
  const asked = Number(url.searchParams.get("w")) || 0;
  const widths = [...manifest.sizes].sort((a, b) => a.w - b.w);
  const size = widths.find((s) => s.w >= asked) ?? widths[widths.length - 1];

  const slide = await openSlide(page, size.w);
  if (!slide) return json(503, { error: "unavailable" });

  const image = await stamp(slide, pass.email, size.w, size.h);
  log("deck.view", { email: pass.email, page, w: size.w, ip: clientIp(request) });

  return new Response(new Uint8Array(image), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(image.length),
      // Which of the sealed widths this is, so the page knows when a larger
      // frame needs a sharper copy.
      "X-Slide-Width": String(size.w),
      ...PRIVATE,
    },
  });
}
