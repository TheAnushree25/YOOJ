import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";

/**
 * The site's server functions, under the dev server.
 *
 * In production /api/* are Vercel Functions. Locally the same files are
 * loaded through Vite and handed the same web-standard Request, so what is
 * tested at localhost is the code that ships - not a mock of it - and saving
 * one of them takes effect on the next request.
 */
const ROUTES: Record<string, string> = {
  "/api/deck/access": "/api/deck/access.ts",
  "/api/deck/slide": "/api/deck/slide.ts",
};

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

export const siteApi = (): Plugin => ({
  name: "yooj-site-api",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (!url.pathname.startsWith("/api/")) return next();

      const file = ROUTES[url.pathname];
      if (!file) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "not-found" }));
        return;
      }

      try {
        const mod = (await server.ssrLoadModule(file)) as Record<string, unknown>;
        const method = (req.method ?? "GET").toUpperCase();
        const handler = mod[method];
        if (typeof handler !== "function") {
          res.statusCode = 405;
          res.end();
          return;
        }

        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
        const body = method === "GET" || method === "HEAD" ? undefined : new Uint8Array(await readBody(req));
        const response = (await handler(new Request(url, { method, headers, body }))) as Response;

        res.statusCode = response.status;
        response.headers.forEach((value, name) => res.setHeader(name, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        if (error instanceof Error) server.ssrFixStacktrace(error);
        next(error);
      }
    });
  },
});
