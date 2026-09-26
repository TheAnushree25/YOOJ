/**
 * The deck's side of the wire: /api/deck/*.
 *
 * Every visit comes through the gate - the pass it hands out lives in the
 * page's memory for the length of the visit and is never kept on the device,
 * so the admin's sheet (written by the gate itself, lib/google-forms) has a
 * row for every sitting, not only the first. What is kept is the address
 * itself, to put back in the field next time: a returning reader is one press
 * from the deck.
 *
 * The pass travels in a header rather than in a URL, where it would be written
 * into history, logs and the address a reader might copy.
 */

export interface DeckMeta {
  email: string;
  title: string;
  pages: number;
  ratio: number;
  expires: number;
}

export interface DeckAccess extends DeckMeta {
  token: string;
}

/**
 * A failure the page can say something useful about.
 *
 * `code` is the server's own word - `email`, `pass`, `unavailable`, `busy` -
 * or `network` when there was no answer at all.
 */
export class DeckError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "DeckError";
    this.code = code;
    this.status = status;
  }
}

const EMAIL_KEY = "yooj.deck.email";
/** Where a 30-day pass used to be kept. Cleared on sight: it would outlive the rule above. */
const OLD_PASS_KEY = "yooj.deck.pass";

export const rememberedEmail = (): string => {
  try {
    localStorage.removeItem(OLD_PASS_KEY);
    return localStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
};

export const rememberEmail = (email: string) => {
  try { localStorage.setItem(EMAIL_KEY, email); } catch { /* private mode: nothing to remember it in */ }
};

const send = async (path: string, init: RequestInit, pass?: string) => {
  const headers = new Headers(init.headers);
  if (pass) headers.set("Authorization", `Bearer ${pass}`);
  try {
    return await fetch(path, { ...init, headers, cache: "no-store", credentials: "same-origin" });
  } catch (error) {
    if ((error as Error | null)?.name === "AbortError") throw error;
    throw new DeckError("network", 0);
  }
};

const failure = async (res: Response) => {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new DeckError(body?.error ?? (res.status === 401 ? "pass" : "server"), res.status);
};

export const requestAccess = async (email: string): Promise<DeckAccess> => {
  const res = await send("/api/deck/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw await failure(res);
  return res.json() as Promise<DeckAccess>;
};

/**
 * One slide, already stamped with the reader's address by the server, and
 * the width it was actually sent at - the nearest the server holds at or
 * above the one asked for.
 */
export const fetchSlide = async (
  pass: string,
  page: number,
  width: number,
  options: { signal?: AbortSignal; ahead?: boolean } = {},
): Promise<{ blob: Blob; width: number; stamped: boolean }> => {
  const res = await send(
    `/api/deck/slide?page=${page}&w=${width}`,
    { method: "GET", signal: options.signal, priority: options.ahead ? "low" : "high" },
    pass,
  );
  if (!res.ok) throw await failure(res);
  return {
    blob: await res.blob(),
    width: Number(res.headers.get("X-Slide-Width")) || width,
    // "0" from a host that cannot draw on an image (yooj.care's Cloudflare
    // Worker): the viewer stamps the slide itself (lib/deck-stamp).
    stamped: res.headers.get("X-Slide-Stamped") !== "0",
  };
};
