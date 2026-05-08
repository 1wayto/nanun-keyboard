# CAD AI-Tooling Design

**Date:** 2026-05-07
**Status:** Approved
**Scope:** Make the CAD tab driveable by both a human (existing UI controls) and an AI agent (Claude Code) through a shared, file-backed state and a small MCP tool surface. Localhost-only, no auth.

## Goals

1. **AI-friendly:** A Claude Code session in this repo can read, mutate, measure, validate, and export CAD parts via well-named JSON-in/JSON-out tools.
2. **Human-friendly:** The existing CAD tab keeps working. UI controls and AI tools mutate the same source of truth.
3. **Incremental:** Build the loop end-to-end with the existing switch plate before adding any new parts.

## Non-goals

- Authentication, multi-user collaboration, or hosted deployment (localhost dev only).
- Visual reasoning by AI (screenshots) — numbers + topology only for the MVP.
- Moving the keyboard layout (`keys[]`) into the CAD spec — phase 2.
- Versioned schema migrations — defer until a second `schemaVersion` exists.

## Architecture

```
┌───────────────────────┐         ┌──────────────────────┐
│  Claude Code (you)    │ ──MCP── │  cad-mcp server      │
│                       │  stdio  │  (Node, runs         │
│  calls tools          │         │   replicad headless) │
└───────────────────────┘         └──────────┬───────────┘
                                             │ reads/writes
                                             ▼
                                    ┌─────────────────┐
                                    │ cad-state.json  │  ← single source of truth
                                    └────────┬────────┘
                                             │ polled / HMR
                                             ▼
                                    ┌─────────────────┐
                                    │ Browser CAD tab │  ← human controls
                                    │ (Vite app)      │     write to same file
                                    └─────────────────┘
```

`cad-state.json` is the single source of truth. Both the human (UI controls in the CAD tab) and the AI (MCP tools) read and write it. The browser re-renders on file change. The MCP server runs replicad in Node so measurements and validation work without a browser.

## State shape

`cad-state.json` (repo root, gitignored, default-initialized on first read):

```jsonc
{
  "schemaVersion": 1,
  "plate": {
    "thickness": 1.5,
    "margin": 5,
    "cornerRadius": 2,
    "cutoutSize": 14.0
  },
  "parts": ["plate"]
  // future siblings: "topCase": {...}, "bottomCase": {...}, "fixtures": [...]
}
```

The `parts` array tracks which registered part types are active in the scene. Adding a new part type later means adding a new top-level key (`topCase`) and including its name in `parts`.

The keyboard layout (`keys[]`) and 2D editor state stay in React (`App.jsx`) for now. The MCP server exposes them read-only via `getLayout()`.

## MCP tool surface (MVP)

| Tool | Inputs | Returns |
|------|--------|---------|
| `getState()` | — | Full `cad-state.json` contents |
| `setParam(path, value)` | `path: "plate.thickness"`, `value: 1.5` | Updated state subtree; persists immediately |
| `getLayout()` | — | `{ count, bounds: {minX,maxX,minY,maxY}, keys: [{id,x,y,w,h,label,isISOEnter}] }` |
| `measure(query)` | `{ kind, part? }` where kind is `"boundingBox" \| "keyPositions" \| "cutoutPositions" \| "partVolume"` | JSON measurements |
| `validate()` | — | `[]` if clean, otherwise `[{ severity, code, msg, partId }]` |
| `exportPart(partId, format, path)` | `format: "step" \| "stl"`, `path` is repo-relative | `{ path, bytes, format }` |
| `listParts()` | — | `{ registered: ["plate", ...], active: ["plate"] }` |

All inputs and outputs are JSON. No images. All paths are validated against repo root to prevent traversal.

### Validation checks (initial set)

- Solid is manifold (closed, no degenerate faces).
- Plate is a single connected component (no isolated islands).
- No two cutouts overlap or merge into a multi-key opening.
- Each layout key has a corresponding cutout in the plate.

Validation runs on demand via `validate()`, not on every mutation.

### Parameter validation

`setParam` enforces a per-path schema (min/max/type). Invalid values are rejected with a structured error rather than silently clamped, so the AI can react.

## Code layout

```
cad-mcp/                       ← new package, Node MCP server (sibling to src/)
  package.json                 ← deps: @modelcontextprotocol/sdk, replicad, replicad-opencascadejs
  src/
    server.js                  ← MCP stdio server, registers tools
    state.js                   ← read/write cad-state.json + schema validation
    parts/
      plate.js                 ← shared part definition (see below)
    measure.js                 ← bounding boxes, volumes, key positions, cutout positions
    validate.js                ← geometry checks
    occt.js                    ← initOCCT() helper for headless replicad

src/cad/
  buildPlate.js                ← thin wrapper around shared parts/plate.js
  syncState.js                 ← NEW: subscribes to cad-state.json, exposes useCadState() hook
src/components/
  CadView.jsx                  ← reads from useCadState() instead of props.plateSettings

shared/cad/                    ← NEW: code consumed by both browser and Node
  parts/plate.js               ← buildPlate(keys, plateParams) → replicad Solid
  schema.js                    ← state schema, default state, param paths

.mcp.json                      ← registers cad-mcp for this repo
.gitignore                     ← add cad-state.json
cad-state.json                 ← created on first run
```

The `shared/cad/parts/plate.js` is the single source of part geometry. Both the MCP server (Node) and the browser (Vite import) consume it. Replicad already supports both runtimes.

## Sync mechanism (browser ← state file)

- **Dev:** A small Vite plugin (`vite-plugin-cad-state`) watches `cad-state.json` and triggers a custom HMR event. The browser hook re-fetches and re-renders.
- **Prod build (`npm run preview`):** Tab polls `/cad-state.json` via fetch every 500ms.

Browser writes (UI control changes) go through a tiny POST endpoint added in dev, or write directly via the same Vite plugin. (Final transport detail finalized in the implementation plan; the constraint is "human and AI write to one place.")

## End-to-end MVP scope

1. MCP server with the seven tools listed above, plate-only.
2. `cad-state.json` + Vite plugin sync.
3. `CadView.jsx` reads from synced state; existing controls write to it.
4. `.mcp.json` registers the server so Claude Code picks it up automatically.
5. README snippet for users explaining how to talk to the CAD via Claude Code.

No new part types are added in this MVP. Adding a part later is a separate, smaller spec: write `shared/cad/parts/<name>.js`, add its params to the schema, register the tool surface entry. Most of an AI's work for new parts is authoring those small modules.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Replicad behaves differently in Node vs browser | Pin the same `replicad` and `replicad-opencascadejs` versions; smoke-test the same plate in both runtimes during MVP. |
| Sync races (AI writes while UI is mid-edit) | Single writer at a time. Each write reads-modifies-writes the full file under a short file lock; UI debounces. |
| 12 MB OCCT WASM startup cost on the MCP server | Lazy init on first tool call that needs geometry; keep OCCT alive across calls (server is long-lived). |
| State file path traversal in `exportPart` | Resolve and assert the export path stays inside repo root. |
| Schema drift between MVP and future parts | All param paths centralized in `shared/cad/schema.js`; `setParam` rejects unknown paths. |

## Open decisions deferred to plan

- Exact transport for browser → state writes (POST vs Vite plugin RPC).
- Whether `cad-state.json` is JSON or JSONC (comments in spec, but JSON for runtime).
- Naming of the MCP server in `.mcp.json` (`cad`, `nanun-cad`, etc.).

## Next step

Move to `writing-plans` to produce a step-by-step implementation plan.
