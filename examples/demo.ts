/**
 * An old-style MCP client (2025-06-18, initialize/initialized handshake)
 * talking through the bridge to a fixture standing in for a 2026-07-28
 * server (no initialize, per-request MCP-Protocol-Version header and _meta
 * clientInfo). Run with: npx tsx examples/demo.ts
 */
import { startVersionBridge } from "../src/index.js";
import { startNewStyleServer } from "../test/fixtures/new-style-server.js";

async function main() {
  const newServer = await startNewStyleServer();
  newServer.respondWith({ content: [{ type: "text", text: "42 results found" }] });

  const bridge = await startVersionBridge({ newServerUrl: newServer.url, newServerProtocolVersion: "2026-07-28" });
  console.log(`Bridge listening at ${bridge.url}, forwarding to 2026-07-28 server at ${newServer.url}\n`);

  console.log("1. Old client sends initialize (2025-06-18 style)...");
  const initRes = await fetch(bridge.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { roots: {} },
        clientInfo: { name: "legacy-agent", version: "3.1.0" },
      },
    }),
  });
  const sessionId = initRes.headers.get("mcp-session-id")!;
  console.log(`   Bridge responded locally (no forward to new server). Session: ${sessionId}\n`);

  console.log("2. Old client calls tools/call as it always has...");
  const callRes = await fetch(bridge.url, {
    method: "POST",
    headers: { "content-type": "application/json", "mcp-session-id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { q: "gap analysis" } } }),
  });
  console.log(`   Response: ${JSON.stringify(await callRes.json())}\n`);

  const forwarded = newServer.received[0]!;
  console.log("3. What the 2026-07-28 server actually received:");
  console.log(`   MCP-Protocol-Version header: ${forwarded.headers["mcp-protocol-version"]}`);
  console.log(`   _meta.clientInfo: ${JSON.stringify((forwarded.body.params as any)._meta["io.modelcontextprotocol/clientInfo"])}`);

  await bridge.stop();
  await newServer.stop();
}

main();
