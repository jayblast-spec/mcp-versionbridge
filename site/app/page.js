import { assetPrefix } from "../site.config.mjs";

const usage = `import { startVersionBridge } from "mcp-versionbridge";

const bridge = await startVersionBridge({
  newServerUrl: "https://my-2026-07-28-server.example.com/mcp",
});

console.log(\`Point your old MCP client at \${bridge.url} instead of the real server.\`);

// later
await bridge.stop();`;

export default function HomePage() {
  return (
    <>
      <header className="masthead">
        <p className="kicker">Documentation</p>
        <h1>mcp-versionbridge</h1>
        <p className="lede">
          Lets an MCP client stuck on the pre-2026-07-28 <code>initialize</code>{" "}
          handshake talk to a 2026-07-28 MCP server, with no changes to either
          side.
        </p>
        <nav aria-label="On this page">
          <a href="#what">What it does</a>
          <a href="#install">Install</a>
          <a href="#usage">Usage</a>
          <a href="#links">Links</a>
        </nav>
      </header>

      <main>
        <img
          className="diagram"
          src={`${assetPrefix}/banner.svg`}
          width={860}
          height={260}
          alt="An old MCP client sends initialize to mcp-versionbridge, which answers the handshake locally and forwards each call with MCP-Protocol-Version and clientInfo to a 2026-07-28 server."
        />

        <section id="what">
          <h2>What it does</h2>
          <p>
            The{" "}
            <a href="https://blog.modelcontextprotocol.io/posts/2026-07-28/">
              2026-07-28 MCP specification
            </a>{" "}
            removed the <code>initialize</code>/<code>initialized</code>{" "}
            handshake and the <code>Mcp-Session-Id</code> header. Older clients
            (2024-11-05, 2025-03-26, 2025-06-18) still negotiate one protocol
            version for the whole session. A 2026-07-28 server never implements{" "}
            <code>initialize</code>, so those clients cannot talk to it.
          </p>
          <p>
            mcp-versionbridge is a small HTTP proxy. It looks like an old-style
            MCP server to the client, and talks to a real 2026-07-28 server
            behind it.
          </p>
          <ol>
            <li>
              The client sends <code>initialize</code> as usual. The bridge
              answers it locally — it is never forwarded — and returns an{" "}
              <code>Mcp-Session-Id</code> the client will echo back.
            </li>
            <li>
              Later requests are forwarded with <code>MCP-Protocol-Version</code>{" "}
              set and{" "}
              <code>params._meta[&quot;io.modelcontextprotocol/clientInfo&quot;]</code>{" "}
              merged in, which is what a native 2026-07-28 client would send.
            </li>
            <li>Responses are relayed back unchanged.</li>
          </ol>
          <p>
            Version 1 bridges an old client to a new server over HTTP. The
            reverse direction, stdio, and <code>server/discover</code> capability
            negotiation are not in this version.
          </p>
        </section>

        <section id="install">
          <h2>Install</h2>
          <pre>
            <code>npm install mcp-versionbridge</code>
          </pre>
        </section>

        <section id="usage">
          <h2>Usage</h2>
          <pre>
            <code>{usage}</code>
          </pre>
          <p>
            The annotated demo runs a fixture 2026-07-28 server and a real
            old-style handshake, and prints what crosses the wire:
          </p>
          <pre>
            <code>npx tsx examples/demo.ts</code>
          </pre>
        </section>

        <section id="links">
          <h2>Links</h2>
          <ul>
            <li>
              <a href="https://github.com/jayblast-spec/mcp-versionbridge">
                Source repository
              </a>
            </li>
            <li>
              <a href="https://www.npmjs.com/package/mcp-versionbridge">
                npm package
              </a>
            </li>
            <li>
              <a href="https://blog.modelcontextprotocol.io/posts/2026-07-28/">
                2026-07-28 MCP specification
              </a>
            </li>
            <li>
              <a href="https://github.com/jayblast-spec/mcp-versionbridge/blob/main/examples/demo.ts">
                Annotated demo
              </a>
            </li>
            <li>
              <a href="https://github.com/jayblast-spec/mcp-versionbridge/blob/main/LICENSE">
                MIT license
              </a>
            </li>
          </ul>
        </section>
      </main>

      <footer>
        <p>
          Built by{" "}
          <a href="https://github.com/jayblast-spec">ArkNet Digital</a>.
        </p>
      </footer>
    </>
  );
}
