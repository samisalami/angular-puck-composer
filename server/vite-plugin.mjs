import { resolve } from "node:path";
import { createStore, handleApi } from "./store.mjs";

/** Mounts the same /api/pages endpoints into the Vite dev server. */
export function pageStore({ dataDir = "data" } = {}) {
  return {
    name: "rm-page-store",
    configureServer(server) {
      const store = createStore(resolve(server.config.root, dataDir));
      server.middlewares.use(async (req, res, next) => {
        if (!(await handleApi(store, req, res))) next();
      });
    },
  };
}
