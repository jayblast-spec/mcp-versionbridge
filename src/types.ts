export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ClientInfo {
  name: string;
  version: string;
}

export interface BridgeOptions {
  /** Base URL of the 2026-07-28-speaking MCP server this bridge forwards to. */
  newServerUrl: string;
  /** The MCP-Protocol-Version header value to send to the new server. Defaults to "2026-07-28". */
  newServerProtocolVersion?: string;
}

export interface BridgeSession {
  requestedProtocolVersion: string;
  clientInfo: ClientInfo;
  capabilities: Record<string, unknown>;
}
