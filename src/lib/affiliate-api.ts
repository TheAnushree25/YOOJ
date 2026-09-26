/**
 * "Join the YOOJ network": the form at the foot of the solutions page, to
 * /api/affiliate, which writes it into the admin's Google Sheet.
 */

export interface AffiliateEntry {
  name: string;
  phone: string;
  city: string;
  email: string;
  business: string;
  who: string;
  /** The honeypot. Always empty from a person. */
  website: string;
}

export type AffiliateField = Exclude<keyof AffiliateEntry, "website">;

export type AffiliateResult =
  | { ok: true }
  | { ok: false; reason: "fields"; fields: AffiliateField[] }
  | { ok: false; reason: "busy" | "unavailable" | "network" };

export const sendAffiliate = async (entry: AffiliateEntry): Promise<AffiliateResult> => {
  let res: Response;
  try {
    res = await fetch("/api/affiliate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => null)) as { error?: string; fields?: AffiliateField[] } | null;
  if (res.status === 400 && body?.error === "fields") return { ok: false, reason: "fields", fields: body.fields ?? [] };
  if (res.status === 429) return { ok: false, reason: "busy" };
  return { ok: false, reason: "unavailable" };
};
