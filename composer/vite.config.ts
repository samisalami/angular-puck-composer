import { cp, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error plain JS module without types
import { pageStore } from "@apc/page-server/vite";

// Output of `ng build elements` (the Angular components as custom elements).
const ELEMENTS_DIR = resolve(__dirname, "../dist/elements/browser");

/**
 * Serves the Angular Elements bundle at /elements/* during dev and copies it into dist/elements on build,
 * so the built composer is self-contained. The bundle is loaded at runtime (see src/main.tsx), not
 * bundled by Vite: Angular and React stay two independent builds.
 */
function angularElements(): Plugin {
  let outDir = "dist";
  return {
    name: "apc-angular-elements",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use("/elements", async (req, res, next) => {
        const file = join(ELEMENTS_DIR, decodeURIComponent((req.url ?? "/").split("?")[0]));
        if (!file.startsWith(ELEMENTS_DIR + sep) || !(await stat(file).catch(() => null))?.isFile()) return next();
        res.setHeader("content-type", extname(file) === ".css" ? "text/css" : "text/javascript");
        res.setHeader("cache-control", "no-cache");
        createReadStream(file).pipe(res);
      });
    },
    async closeBundle() {
      await cp(ELEMENTS_DIR, join(outDir, "elements"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), pageStore({ dataDir: "data" }), angularElements()],
});
