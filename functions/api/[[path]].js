/**
 * yooj.care is served by Cloudflare Pages, which serves the built site but
 * does not run the functions in api/ - those run on Vercel, at yooj.vercel.app.
 * This Pages Function hands every /api/* request on to them and their answer
 * back, unchanged: the deck and the forms work on yooj.care as they do there.
 *
 * Seen from Vercel, every request now comes from Cloudflare, so the visitor's
 * own address and Cloudflare's reading of where they are go along as x-yooj-*
 * headers - for the functions' rate limits and the visit record. The functions
 * believe them only from Cloudflare's addresses (server/http.ts, viaCloudflare).
 *
 * API_ORIGIN in the Pages project's variables points it elsewhere if the
 * functions ever move.
 */
const ORIGIN = "https://yooj.vercel.app";

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.API_ORIGIN || ORIGIN);

  const headers = new Headers(request.headers);
  headers.delete("host");
  // Only this function says who the visitor is - never the visitor.
  for (const name of ["x-yooj-client-ip", "x-yooj-city", "x-yooj-country"]) headers.delete(name);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-yooj-client-ip", ip);
  if (request.cf?.city) headers.set("x-yooj-city", encodeURIComponent(request.cf.city));
  if (request.cf?.country) headers.set("x-yooj-country", request.cf.country);

  const answer = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
  return new Response(answer.body, answer);
}
