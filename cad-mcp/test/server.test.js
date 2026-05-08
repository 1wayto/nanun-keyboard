import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { oneKeyLayout } from "./fixtures/oneKey.js";

let client, server, dir;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "cad-server-"));
  const stateFile = join(dir, "cad-state.json");
  process.env.CAD_LAYOUT_JSON = JSON.stringify(oneKeyLayout);

  const built = createServer({ stateFile, repoRoot: dir });
  server = built.server;

  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await server.connect(a);
  await client.connect(b);
});

afterAll(async () => {
  await client?.close();
  await server?.close();
  delete process.env.CAD_LAYOUT_JSON;
  rmSync(dir, { recursive: true, force: true });
});

describe("MCP server", () => {
  it("registers nine tools (added getMatrix + validateMatrix)", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "exportPart",
      "getLayout",
      "getMatrix",
      "getState",
      "listParts",
      "measure",
      "setParam",
      "validate",
      "validateMatrix",
    ]);
  });

  it("getMatrix returns the matrix for the seeded layout", async () => {
    const r = await client.callTool({ name: "getMatrix", arguments: {} });
    const json = JSON.parse(r.content[0].text);
    expect(json.dims.rows).toBe(1);
    expect(json.dims.cols).toBe(1);
    expect(json.keyMatrix.k0).toMatchObject({ row: 0, col: 0 });
  });

  it("validateMatrix returns [] for the seeded layout", async () => {
    const r = await client.callTool({ name: "validateMatrix", arguments: {} });
    const json = JSON.parse(r.content[0].text);
    expect(json).toEqual([]);
  });

  it("getState returns DEFAULT_STATE on first call", async () => {
    const r = await client.callTool({ name: "getState", arguments: {} });
    const json = JSON.parse(r.content[0].text);
    expect(json.plate.thickness).toBe(1.5);
  });

  it("setParam updates state and persists", async () => {
    const r = await client.callTool({
      name: "setParam",
      arguments: { path: "plate.thickness", value: 2.0 },
    });
    const json = JSON.parse(r.content[0].text);
    expect(json.ok).toBe(true);
    const state = await client.callTool({ name: "getState", arguments: {} });
    expect(JSON.parse(state.content[0].text).plate.thickness).toBe(2.0);
  });

  it("getLayout returns the seeded layout", async () => {
    const r = await client.callTool({ name: "getLayout", arguments: {} });
    const json = JSON.parse(r.content[0].text);
    expect(json.count).toBe(1);
    expect(json.keys[0].id).toBe("k0");
  });
});
