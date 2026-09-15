import { createServer, type Server } from "node:http";

export interface ReceivedCall {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

export interface NewStyleServer {
  url: string;
  received: ReceivedCall[];
  /** Configure the JSON-RPC result this server responds with for the next call. */
  respondWith(result: unknown): void;
  stop(): Promise<void>;
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** A minimal fixture standing in for a real 2026-07-28 MCP server: no initialize, expects per-request headers/_meta. */
export function startNewStyleServer(): Promise<NewStyleServer> {
  const received: ReceivedCall[] = [];
  let nextResult: unknown = { ok: true };

  const server: Server = createServer(async (req, res) => {
    const body = await readBody(req);
    const parsed = JSON.parse(body) as Record<string, unknown>;
    received.push({ headers: req.headers, body: parsed });
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: nextResult })
    );
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("fixture server failed to bind a port"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        received,
        respondWith: (result: unknown) => {
          nextResult = result;
        },
        stop: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
