#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { createStateStore } from "./state.js";
import { measure } from "./measure.js";
import { validate } from "./validate.js";
import { exportPart } from "./exportPart.js";
import { initOCCT } from "./occt.js";
import { getMatrix, validateMatrix } from "./electrical.js";
import { PARAM_PATHS } from "../../shared/cad/schema.js";

export function createServer({ stateFile, repoRoot }) {
  const store = createStateStore(stateFile);

  function getLayoutFromEnv() {
    const raw = process.env.CAD_LAYOUT_JSON;
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  const server = new Server(
    { name: "nanun-cad", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const TOOLS = [
    { name: "getState", description: "Return the full CAD design state.",
      inputSchema: { type: "object", properties: {} } },
    { name: "setParam", description: `Set a CAD parameter. Allowed paths: ${PARAM_PATHS.join(", ")}.`,
      inputSchema: { type: "object", required: ["path", "value"],
        properties: { path: { type: "string" }, value: {} } } },
    { name: "getLayout", description: "Read-only keyboard layout (count, bounds, keys).",
      inputSchema: { type: "object", properties: {} } },
    { name: "measure", description: "Geometric measurement. kind: boundingBox | partVolume | keyPositions | cutoutPositions.",
      inputSchema: { type: "object", required: ["query"],
        properties: { query: { type: "object" } } } },
    { name: "validate", description: "Run geometric validation; returns [] when clean.",
      inputSchema: { type: "object", properties: {} } },
    { name: "exportPart", description: "Write a part to disk. format: step | stl. path is repo-relative.",
      inputSchema: { type: "object", required: ["partId", "format", "path"],
        properties: { partId: { type: "string" }, format: { type: "string" }, path: { type: "string" } } } },
    { name: "listParts", description: "List registered and active part types.",
      inputSchema: { type: "object", properties: {} } },
    { name: "getMatrix", description: "Compute the row/column matrix and ESP32 GPIO pinmap for the current layout.",
      inputSchema: { type: "object", properties: {} } },
    { name: "validateMatrix", description: "Run matrix validation; returns [] when clean. Codes: unknown_board, pin_overflow, unsafe_gpio, gpio_collision, gpio_too_few.",
      inputSchema: { type: "object", properties: {} } },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    let result;
    switch (name) {
      case "getState":
        result = store.read();
        break;
      case "setParam":
        result = store.setParam(args.path, args.value);
        break;
      case "getLayout": {
        const keys = getLayoutFromEnv();
        const xs = keys.map((k) => k.x);
        const ys = keys.map((k) => k.y);
        result = {
          count: keys.length,
          bounds: keys.length
            ? { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
            : null,
          keys,
        };
        break;
      }
      case "measure":
        await initOCCT();
        result = measure(args.query, getLayoutFromEnv(), store.read());
        break;
      case "validate":
        await initOCCT();
        result = validate(getLayoutFromEnv(), store.read());
        break;
      case "exportPart":
        await initOCCT();
        result = await exportPart(
          { partId: args.partId, format: args.format, path: args.path },
          getLayoutFromEnv(),
          store.read(),
          repoRoot,
        );
        break;
      case "listParts":
        result = { registered: ["plate"], active: store.read().parts };
        break;
      case "getMatrix":
        result = getMatrix(getLayoutFromEnv(), store.read());
        break;
      case "validateMatrix":
        result = validateMatrix(getLayoutFromEnv(), store.read());
        break;
      default:
        throw new Error(`unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  return { server, store };
}

const isMain = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]);
if (isMain) {
  const repoRoot = resolve(process.cwd());
  const stateFile = resolve(repoRoot, "cad-state.json");
  const { server } = createServer({ stateFile, repoRoot });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
