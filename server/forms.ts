import { readFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "./http.js";

/**
 * Responses for the admin's Google Forms - and through them, the sheets.
 *
 * Two forms: who opened the deck, and who asked to join the network from the
 * solutions page. Each is linked to its spreadsheet in Google Forms (Responses
 * > Link to Sheets), so every response posted here lands as a row there, with
 * Google's own timestamp.
 *
 * Posted from the server, not the page: the answer is readable here (a page
 * posting cross-site to Google cannot see whether it worked), so the page is
 * only told "thank you" once Google has taken it; and the fields are checked
 * before anything is sent.
 *
 * Which form, and which question each field goes to, is in
 * integrations/google-forms/forms.json - written by `npm run forms:link` from
 * the forms' own links, and nothing secret: a form's id and its questions'
 * entry numbers are in the form's own page for anyone who opens it.
 */
export type FormKind = "deck" | "affiliate";

interface FormLink {
  /** The form's published id (the part after /forms/d/e/ in its link), or its full link. */
  form: string;
  /** The site's field name -> the form question's `entry.<n>`. Empty: not linked, not sent. */
  entries: Record<string, string>;
}

let links: Record<FormKind, FormLink> | null = null;

/** Read once per warm instance. A deploy is a new instance, so an edit is picked up then. */
const config = (): Record<FormKind, FormLink> | null => {
  if (links) return links;
  try {
    const file = join(process.cwd(), "integrations", "google-forms", "forms.json");
    links = JSON.parse(readFileSync(file, "utf8")) as Record<FormKind, FormLink>;
    return links;
  } catch (error) {
    log("forms.config", { error: String((error as Error)?.message ?? error) });
    return null;
  }
};

/** Where a form's responses are posted, from its id or any of its links. */
const actionFor = (form: string) => {
  const value = form.trim();
  if (/^https?:\/\//.test(value)) return value.replace(/\/(viewform|formResponse)(\?.*)?$/, "") + "/formResponse";
  return `https://docs.google.com/forms/d/e/${value}/formResponse`;
};

/** Whether this kind of response has a form to go to on this host. */
export const formReady = (kind: FormKind) => {
  const link = config()?.[kind];
  return Boolean(link?.form.trim() && Object.values(link.entries).some((entry) => entry.trim()));
};

/**
 * One response, keyed by the site's field names, posted the way the form's own
 * page posts it. True once Google has accepted it; false when the form is not
 * linked, did not answer in time, or refused - the reason goes to the logs.
 *
 * Google answers an accepted response with 200 and its "response recorded"
 * page. A redirect means the form wants a signed-in Google account (it
 * collects verified emails, or allows one response per person), which a
 * website cannot give it - so redirects are not followed, and count as refused.
 */
export const submitForm = async (
  kind: FormKind,
  row: Record<string, string>,
  timeoutMs = 10_000,
): Promise<boolean> => {
  const link = config()?.[kind];
  if (!link || !formReady(kind)) {
    log("forms.unlinked", { kind });
    return false;
  }

  const body = new URLSearchParams();
  for (const [field, entry] of Object.entries(link.entries)) {
    const name = entry.trim();
    if (!name) continue;
    body.append(name.startsWith("entry.") ? name : `entry.${name}`, row[field] ?? "");
  }
  // What the form's own page sends alongside the answers of a one-page form.
  body.append("fvv", "1");
  body.append("pageHistory", "0");

  try {
    const res = await fetch(actionFor(link.form), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 200) {
      log("forms.sent", { kind });
      return true;
    }
    log("forms.refused", { kind, status: res.status, location: res.headers.get("location") ?? undefined });
    return false;
  } catch (error) {
    log("forms.failed", { kind, error: String((error as Error)?.message ?? error) });
    return false;
  }
};
