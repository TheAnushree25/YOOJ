import links from "../../integrations/google-forms/forms.json";

/**
 * The admin's Google Forms, posted to straight from the visitor's browser -
 * and so into the spreadsheets they are linked to.
 *
 * No server of ours stands in between, so it works wherever the site is
 * served from: yooj.care, which Cloudflare serves as files alone, as much as
 * Vercel or a laptop. Two forms: who opened the deck (the gate), and who asked
 * to join the network (the foot of the solutions page).
 *
 * Google does not let another site read its answer - the post is `no-cors` -
 * so "sent" means Google received it, not that it kept it. Everything it could
 * refuse is checked before sending, the way the form itself checks: every
 * question answered, the choice one of its options. Which form, and which
 * question each field goes to, is integrations/google-forms/forms.json,
 * written from the forms' own links by `npm run forms:link`.
 */
export type FormKind = keyof typeof links;

/** Where a form's responses go, from its published id or any of its links. */
const actionFor = (form: string) => {
  const value = form.trim();
  if (/^https?:\/\//.test(value)) return value.replace(/\/(viewform|formResponse)(\?.*)?$/, "") + "/formResponse";
  return `https://docs.google.com/forms/d/e/${value}/formResponse`;
};

/**
 * One response, keyed by the form's question titles as forms.json names
 * them. True once Google has received it; false when it could not be sent at
 * all (offline, or blocked on the way).
 *
 * `keepalive`, so a response sent as the page moves on - the gate opening the
 * deck - still arrives.
 */
export const sendToForm = async (kind: FormKind, row: Record<string, string>): Promise<boolean> => {
  const link = links[kind];
  const body = new URLSearchParams();
  for (const [question, entry] of Object.entries(link.entries) as [string, string][]) {
    const name = entry.trim();
    if (!name) continue;
    body.append(name.startsWith("entry.") ? name : `entry.${name}`, row[question] ?? "");
  }
  // What the form's own page sends alongside the answers of a one-page form.
  body.append("fvv", "1");
  body.append("pageHistory", "0");

  try {
    await fetch(actionFor(link.form), { method: "POST", mode: "no-cors", body, keepalive: true });
    return true;
  } catch {
    return false;
  }
};
