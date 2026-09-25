/**
 * An email address, tidied, or null.
 *
 * Deliberately a shape check and no more: the address is what gets stamped on
 * the pages, so it has to be one line of printable text that looks like an
 * address. Whether the reader owns it is not something a gate without a mail
 * round trip can know.
 */
export const normaliseEmail = (input: unknown): string | null => {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;

  const at = email.lastIndexOf("@");
  if (at < 1 || at > 64) return null;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return null;
  }
  // Labels of letters, digits and inner hyphens; a top-level label that starts
  // with a letter (which admits punycode, `xn--...`).
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain)) return null;

  return email;
};
