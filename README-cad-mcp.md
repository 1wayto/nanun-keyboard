# Talking to the CAD via Claude Code

The `nanun-cad` MCP server lets a Claude Code session in this repo read, mutate, measure, validate, and export the parametric CAD design.

## How it works

1. `cad-state.json` (repo root, gitignored) holds the design parameters.
2. The Vite dev server watches the file and pushes updates to the open browser CAD tab.
3. The `nanun-cad` MCP server (registered in `.mcp.json`) exposes seven tools to Claude.
4. Both the human (UI controls) and the AI (MCP tools) write to the same file.

## Run it

```bash
npm install
cd cad-mcp && npm install && cd ..
npm run dev          # starts Vite (browser CAD tab)
```

Claude Code auto-discovers `.mcp.json` when launched in this repo, so no extra step is needed. In a Claude Code session, ask "what's the current plate thickness?" and the AI will call `getState`.

## Tools

| Tool | Use it for |
|------|------------|
| `getState` | Read the full design |
| `setParam("plate.thickness", 1.5)` | Mutate one parameter |
| `getLayout` | Read-only key positions |
| `measure({ kind: "boundingBox", part: "plate" })` | Numeric dimensions |
| `validate` | Geometry checks (overlap, manifold, dimensions) |
| `exportPart({ partId: "plate", format: "step", path: "out/plate.step" })` | Write a CAD file |
| `listParts` | Catalog of registered + active parts |

## Adding a new part

1. Create `shared/cad/parts/<name>.js` exporting `build<Name>(keys, params) → replicad Solid`.
2. Add its parameter paths to `shared/cad/schema.js` (PARAM_SCHEMA + DEFAULT_STATE).
3. Wire `getPart()` in `cad-mcp/src/measure.js`, `validate.js`, `exportPart.js` to dispatch to the new builder.
4. Add the part name to `listParts` registered list in `cad-mcp/src/server.js`.

That's it — the AI gets the new part automatically through the existing tool surface.
