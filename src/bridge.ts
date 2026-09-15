import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import type { BridgeOptions, BridgeSession, JsonRpcRequest, JsonRpcResponse } from "./types.js";

export interface VersionBridge {
  url: string;
  stop(): Promise<void>;
}

const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";

function jsonRpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Bridges an MCP client that only speaks the pre-2026-07-28 `initialize` /
 * `initialized` handshake (one protocol version negotiated for the whole
 * session, tracked via an `Mcp-Session-Id` header) to an MCP server that
 * only speaks 2026-07-28 (no `initialize` method at all -- every request
 * carries its own `MCP-Protocol-Version` header and client identity in
 * `params._meta["io.modelcontextprotocol/clientInfo"]`).
 *
 * v1 direction only: old client -> new server. See README for exact scope
 * and what is intentionally not implemented (new client -> old server,
 * stdio transport, `server/discover`-based capability negotiation).
 */
export function startVersionBridge(options: BridgeOptions): Promise<VersionBridge> {
  const newServerProtocolVersion = options.newServerProtocolVersion ?? "2026-07-28";
  const sessions = new Map<string, BridgeSession>();

  const server: Server = createServer((req, res) => {
    void handle(req, res);
  });

  async function handle(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
    if (req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }

    const body = await readBody(req);
    let message: JsonRpcRequest;
    try {
      message = JSON.parse(body);
    } catch {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify(jsonRpcError(null, -32700, "Parse error")));
      return;
    }

    if (message.method === "initialize") {
      handleInitialize(message, res);
      return;
    }

    if (message.method === "notifications/initialized") {
      res.writeHead(202).end();
      return;
    }

    await handleForwardedCall(req, message, res);
  }

  function handleInitialize(message: JsonRpcRequest, res: import("node:http").ServerResponse) {
    const params = message.params ?? {};
    const requestedProtocolVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : "unknown";
    const clientInfo = (params.clientInfo as BridgeSession["clientInfo"] | undefined) ?? { name: "unknown-client", version: "0.0.0" };
    const capabilities = (params.capabilities as Record<string, unknown> | undefined) ?? {};

    const sessionId = randomUUID();
    sessions.set(sessionId, { requestedProtocolVersion, clientInfo, capabilities });

    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: message.id ?? null,
      result: {
        protocolVersion: requestedProtocolVersion,
        capabilities,
        serverInfo: { name: "mcp-versionbridge", version: "0.1.0" },
      },
    };
    res.writeHead(200, { "content-type": "application/json", "mcp-session-id": sessionId }).end(JSON.stringify(response));
  }

  async function handleForwardedCall(req: import("node:http").IncomingMessage, message: JsonRpcRequest, res: import("node:http").ServerResponse) {
    const sessionId = req.headers["mcp-session-id"];
    const session = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;
    if (!session) {
      res
        .writeHead(400, { "content-type": "application/json" })
        .end(JSON.stringify(jsonRpcError(message.id ?? null, -32000, "No active session -- send initialize first")));
      return;
    }

    const forwarded: JsonRpcRequest = {
      ...message,
      params: {
        ...message.params,
        _meta: {
          ...(message.params?._meta as Record<string, unknown> | undefined),
          [CLIENT_INFO_META_KEY]: session.clientInfo,
        },
      },
    };

    const upstreamRes = await fetch(options.newServerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "MCP-Protocol-Version": newServerProtocolVersion,
      },
      body: JSON.stringify(forwarded),
    });

    const upstreamBody = await upstreamRes.text();
    res.writeHead(upstreamRes.status, { "content-type": "application/json" }).end(upstreamBody);
  }

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("version bridge failed to bind a port"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        stop: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
