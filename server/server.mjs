#!/usr/bin/env node
// Production server: serves a built SPA from STATIC_DIR and stores pages as JSON in DATA_DIR.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createStore, handleApi } from "./store.mjs";

const PORT = Number(process.env.PORT ?? 3000);
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? "dist");
const DATA_DIR = resolve(process.env.DATA_DIR ?? "data");

const store = createStore(DATA_DIR);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function serveStatic(req, res) {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  let file = join(STATIC_DIR, path);
  if (!file.startsWith(STATIC_DIR)) return res.writeHead(403).end();

  const info = await stat(file).catch(() => null);
  // SPA fallback: unknown paths get index.html so client-side routes like /view/foo work.
  if (!info || info.isDirectory()) file = join(STATIC_DIR, "index.html");

  const hashed = file.startsWith(join(STATIC_DIR, "assets") + sep);
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  if (req.url === "/healthz") return res.writeHead(200).end("ok");
  if (await handleApi(store, req, res)) return;
  if (req.method !== "GET" && req.method !== "HEAD") return res.writeHead(405).end();
  await serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`page-server on :${PORT} static=${STATIC_DIR} data=${DATA_DIR}`);
});
