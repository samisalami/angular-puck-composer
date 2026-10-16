import { mkdir, readFile, readdir, stat, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** JSON-file page store. One file per page so it can live on a plain Docker volume. */
export function createStore(dataDir) {
  const file = (slug) => join(dataDir, `${slug}.json`);

  return {
    isValidSlug: (slug) => SLUG.test(slug),

    async list() {
      await mkdir(dataDir, { recursive: true });
      const names = (await readdir(dataDir)).filter((n) => n.endsWith(".json"));
      const pages = await Promise.all(
        names.map(async (n) => ({
          slug: n.slice(0, -5),
          updatedAt: (await stat(join(dataDir, n))).mtime.toISOString(),
        })),
      );
      return pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async get(slug) {
      try {
        return JSON.parse(await readFile(file(slug), "utf8"));
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
    },

    async put(slug, data) {
      await mkdir(dataDir, { recursive: true });
      // Write-then-rename so a crash never leaves a half-written page behind.
      const tmp = `${file(slug)}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, file(slug));
    },
  };
}

const MAX_BODY = 5 * 1024 * 1024;

/**
 * Handles /api/pages and /api/pages/:slug. Returns true if the request was handled.
 * Shared by the production server and the Vite dev middleware.
 */
export async function handleApi(store, req, res) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/pages")) return false;

  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  try {
    const slug = url.pathname.replace(/^\/api\/pages\/?/, "");
    if (!slug) {
      if (req.method !== "GET") return send(405, { error: "method not allowed" }), true;
      return send(200, await store.list()), true;
    }
    if (!store.isValidSlug(slug)) return send(400, { error: "slug must match [a-z0-9-]" }), true;

    if (req.method === "GET") {
      const page = await store.get(slug);
      return send(page ? 200 : 404, page ?? { error: "not found" }), true;
    }
    if (req.method === "PUT") {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) return send(413, { error: "page too large" }), true;
        chunks.push(chunk);
      }
      await store.put(slug, JSON.parse(Buffer.concat(chunks).toString("utf8")));
      return send(200, { ok: true, slug }), true;
    }
    return send(405, { error: "method not allowed" }), true;
  } catch (err) {
    console.error(err);
    return send(err instanceof SyntaxError ? 400 : 500, { error: String(err.message ?? err) }), true;
  }
}
