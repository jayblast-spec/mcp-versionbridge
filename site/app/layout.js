import "./globals.css";

export const metadata = {
  title: "mcp-versionbridge",
  description:
    "Lets an MCP client stuck on the pre-2026-07-28 initialize handshake talk to a 2026-07-28 MCP server, with no changes to either side.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
