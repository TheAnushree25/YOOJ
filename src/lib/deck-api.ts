/**
 * The deck's side of the wire: /api/deck/*.
 *
 * The pass the gate hands out is kept on this device so a reader can come back
 * to the deck without the gate, and it travels in a header rather than in a
 * URL, where it would be written into history, logs and the address a reader
 * might copy.
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
 * `code` is the server's own word - `email`, `pass`, `unavailable` - or
 * `network` when there was no answer at all.
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

const PASS_KEY = "yooj.deck.pass";

export const storedPass = (): string | null => {
  try { return localStorage.getItem(PASS_KEY); } catch { return null; }
};

export const keepPass = (token: string) => {
  try { localStorage.setItem(PASS_KEY, token); } catch { /* private mode: the pass lasts as long as the tab */ }
};

export const dropPass = () => {
  try { localStorage.removeItem(PASS_KEY); } catch { /* nothing was kept */ }
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

export const fetchMeta = async (pass: string): Promise<DeckMeta> => {
  const res = await send("/api/deck/meta", { method: "GET" }, pass);
  if (!res.ok) throw await failure(res);
  return res.json() as Promise<DeckMeta>;
};

/** One slide, already stamped with the reader's address by the server. */
export const fetchSlide = async (
  pass: string,
  page: number,
  width: number,
  options: { signal?: AbortSignal; ahead?: boolean } = {},
): Promise<Blob> => {
  const res = await send(
    `/api/deck/slide?page=${page}&w=${width}`,
    { method: "GET", signal: options.signal, priority: options.ahead ? "low" : "high" },
    pass,
  );
  if (!res.ok) throw await failure(res);
  return res.blob();
};
