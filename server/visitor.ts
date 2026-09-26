/**
 * A visitor, described for a person reading a spreadsheet.
 *
 * Coarse on purpose: the kind of device and browser, and the city the host
 * places the connection in. No IP address - the admin wants to know who read
 * the deck and roughly from where, not to trace a connection.
 */

/** "iPhone · Safari", "Windows · Chrome", "Mac · Firefox"... or "" if unknown. */
export const deviceOf = (ua: string | null) => {
  if (!ua) return "";
  const os =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua)) ? "iPad"
    : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet")
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /CrOS/.test(ua) ? "Chromebook"
    : /Linux/.test(ua) ? "Linux"
    : "";
  // Order matters: every Chromium browser also says "Chrome", and Chrome
  // also says "Safari".
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\/|FxiOS/.test(ua) ? "Firefox"
    : /Chrome\/|CriOS/.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "";
  return [os, browser].filter(Boolean).join(" · ");
};

/**
 * "Mumbai, IN" from the host's geolocation headers (Vercel sets these on every
 * request), or "" where there are none - as on the dev server.
 */
export const placeOf = (request: Request) => {
  const read = (name: string) => {
    const value = request.headers.get(name);
    if (!value) return "";
    try { return decodeURIComponent(value).trim(); } catch { return value.trim(); }
  };
  return [read("x-vercel-ip-city"), read("x-vercel-ip-country")].filter(Boolean).join(", ");
};
