// Vite plugin that syncs the browser CAD tab to cad-state.json:
//   • Watches the file and triggers an HMR custom event on change.
//   • Adds a POST /__cad_state endpoint so the browser can write updates.
//   • Adds a GET  /__cad_state endpoint for the browser's initial fetch.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStateStore } from "./cad-mcp/src/state.js";

export default function cadStatePlugin({ filePath = "cad-state.json" } = {}) {
  let absPath, store;

  return {
    name: "cad-state",

    configResolved(cfg) {
      absPath = resolve(cfg.root, filePath);
      store = createStateStore(absPath);
      // Force initial seed.
      store.read();
    },

    configureServer(server) {
      server.watcher.add(absPath);
      server.watcher.on("change", (changed) => {
        if (resolve(changed) !== absPath) return;
        server.ws.send({ type: "custom", event: "cad-state:changed" });
      });

      server.middlewares.use("/__cad_state", (req, res) => {
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(readFileSync(absPath, "utf8"));
          return;
        }
        if (req.method === "POST") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            try {
              const payload = JSON.parse(body); // { path, value }
              const r = store.setParam(payload.path, payload.value);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = r.ok ? 200 : 400;
              res.end(JSON.stringify(r));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}
