/**
 * What every response from the site's functions carries.
 *
 * Nothing they send may be cached anywhere but the reader's own tab: a deck
 * slide is stamped for one person, and a shared cache that kept it would hand
 * that person's copy to the next.
 */
export const PRIVATE: Record<string, string> = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...PRIVATE },
  });

/** The pass, from `Authorization: Bearer ...` - never from the URL, where it would end up in logs and history. */
export const bearer = (request: Request) => {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
};

export const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || request.headers.get("x-real-ip")
  || "unknown";

/**
 * One line per event, as JSON, into the host's function logs.
 *
 * The technical trail - which pages of the deck were read, what Google
 * refused. The admin's own record of visits and sign-ups is the Google Forms'
 * sheets (server/forms.ts); this lives only as long as the host keeps its logs.
 */
export const log = (event: string, fields: Record<string, unknown>) => {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
};
