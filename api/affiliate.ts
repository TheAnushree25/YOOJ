import { normaliseEmail } from "../server/deck/email.js";
import { clientIp, json, log } from "../server/http.js";
import { allow } from "../server/limit.js";
import { formReady, submitForm } from "../server/forms.js";

/**
 * POST /api/affiliate  { name, phone, city, email, business, who }
 *
 * "Join the YOOJ network", from the foot of the solutions page: one response
 * to the affiliate Google Form per sign-up, and so one row in the sheet the
 * form is linked to. The page is told it worked only once Google has taken
 * it, so a thank-you on screen means a row in the sheet.
 */

/** The choices the form offers. Matches the select in AlephAccess.vue. */
const WHO = ["Clinic OPDs", "Pathology", "Radiology", "Pharmacy"];

/** One line of plain text between the given lengths, or null. */
const line = (value: unknown, min: number, max: number) => {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length >= min && text.length <= max ? text : null;
};

/** Digits, spaces, dashes, brackets and a leading plus; seven to fifteen digits. */
const phoneOf = (value: unknown) => {
  const text = line(value, 7, 24);
  if (!text || !/^\+?[\d\s()-]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15 ? text : null;
};

export async function POST(request: Request) {
  if (!allow(`affiliate:${clientIp(request)}`, 6, 10 * 60 * 1000)) return json(429, { error: "busy" });

  let body: Record<string, unknown> = {};
  try {
    body = ((await request.json()) as Record<string, unknown> | null) ?? {};
  } catch {
    // Every field reads as missing below, which is the answer.
  }

  // The honeypot: a field no person sees or fills. A bot that fills it is
  // thanked and forgotten.
  if (typeof body.website === "string" && body.website.trim()) return json(200, { ok: true });

  const entry = {
    name: line(body.name, 2, 80),
    phone: phoneOf(body.phone),
    city: line(body.city, 2, 60),
    email: normaliseEmail(body.email),
    business: line(body.business, 2, 120),
    who: typeof body.who === "string" && WHO.includes(body.who) ? body.who : null,
  };
  const missing = Object.entries(entry).filter(([, value]) => !value).map(([field]) => field);
  if (missing.length) return json(400, { error: "fields", fields: missing });

  if (!formReady("affiliate")) return json(503, { error: "unavailable" });

  const ok = await submitForm("affiliate", {
    Name: entry.name as string,
    "Phone Number": entry.phone as string,
    City: entry.city as string,
    Email: entry.email as string,
    "Business Name": entry.business as string,
    "You are": entry.who as string,
  });
  if (!ok) return json(502, { error: "unavailable" });

  log("affiliate.signup", { email: entry.email, who: entry.who });
  return json(200, { ok: true });
}
