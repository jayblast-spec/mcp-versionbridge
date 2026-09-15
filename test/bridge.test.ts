import { afterEach, describe, expect, it } from "vitest";
import { startVersionBridge, type VersionBridge } from "../src/bridge.js";
import { startNewStyleServer, type NewStyleServer } from "./fixtures/new-style-server.js";

let bridge: VersionBridge | undefined;
let newServer: NewStyleServer | undefined;

afterEach(async () => {
  await bridge?.stop();
  await newServer?.stop();
  bridge = undefined;
  newServer = undefined;
});

async function rpc(url: string, body: Record<string, unknown>, sessionId?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: res.status, headers: res.headers, body: (await res.json()) as Record<string, unknown> };
}

describe("old-style initialize handshake", () => {
  it("responds to initialize without forwarding to the new server, and issues a session id", async () => {
    newServer = await startNewStyleServer();
    bridge = await startVersionBridge({ newServerUrl: newServer.url });

    const res = await rpc(bridge.url, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { roots: {} },
        clientInfo: { name: "old-client", version: "1.0" },
      },
    });

    expect(res.status).toBe(200);
    expect((res.body.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
    expect(res.headers.get("mcp-session-id")).toBeTruthy();
    expect(newServer.received).toHaveLength(0);
  });

  it("acknowledges notifications/initialized without forwarding it", async () => {
    newServer = await startNewStyleServer();
    bridge = await startVersionBridge({ newServerUrl: newServer.url });

    const res = await fetch(bridge.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect(res.status).toBe(202);
    expect(newServer.received).toHaveLength(0);
  });
});

describe("forwarding calls after initialize", () => {
  it("injects MCP-Protocol-Version header and _meta clientInfo, forwards the rest unchanged", async () => {
    newServer = await startNewStyleServer();
    bridge = await startVersionBridge({ newServerUrl: newServer.url, newServerProtocolVersion: "2026-07-28" });

    const init = await rpc(bridge.url, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "old-client", version: "1.0" } },
    });
    const sessionId = init.headers.get("mcp-session-id")!;

    const result = await rpc(
      bridge.url,
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { q: "hi" } } },
      sessionId
    );

    expect(result.status).toBe(200);
    expect(newServer.received).toHaveLength(1);
    const call = newServer.received[0]!;
    expect(call.headers["mcp-protocol-version"]).toBe("2026-07-28");
    const body = call.body as { method: string; params: { name: string; _meta: Record<string, unknown> } };
    expect(body.method).toBe("tools/call");
    expect(body.params.name).toBe("search");
    expect(body.params._meta["io.modelcontextprotocol/clientInfo"]).toEqual({ name: "old-client", version: "1.0" });
  });

  it("preserves any _meta the old client already sent, merging in clientInfo rather than overwriting it", async () => {
    newServer = await startNewStyleServer();
    bridge = await startVersionBridge({ newServerUrl: newServer.url });

    const init = await rpc(bridge.url, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "old-client", version: "1.0" } },
    });
    const sessionId = init.headers.get("mcp-session-id")!;

    await rpc(
      bridge.url,
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", _meta: { "custom/trace-id": "abc123" } } },
      sessionId
    );

    const body = newServer.received[0]!.body as { params: { _meta: Record<string, unknown> } };
    expect(body.params._meta["custom/trace-id"]).toBe("abc123");
    expect(body.params._meta["io.modelcontextprotocol/clientInfo"]).toEqual({ name: "old-client", version: "1.0" });
  });

  it("rejects a call with no prior initialize (unknown or missing session id) with a JSON-RPC error", async () => {
    newServer = await startNewStyleServer();
    bridge = await startVersionBridge({ newServerUrl: newServer.url });

    const res = await rpc(bridge.url, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(newServer.received).toHaveLength(0);
  });

  it("relays the new server's response body and status back to the old client unchanged", async () => {
    newServer = await startNewStyleServer();
    newServer.respondWith({ content: [{ type: "text", text: "search results here" }] });
    bridge = await startVersionBridge({ newServerUrl: newServer.url });

    const init = await rpc(bridge.url, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "old-client", version: "1.0" } },
    });
    const sessionId = init.headers.get("mcp-session-id")!;

    const result = await rpc(bridge.url, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search" } }, sessionId);
    expect(result.body.result).toEqual({ content: [{ type: "text", text: "search results here" }] });
  });
});
