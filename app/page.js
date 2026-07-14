// Static landing page. No more self-hosted enroll flow (Google login) — the
// athlete connects from Claude, which sends them straight to Intervals.icu login.
import { headers } from "next/headers"

const card = { maxWidth: 680, margin: "0 auto", padding: "40px 24px", lineHeight: 1.7 }
const box = {
  background: "#14181d",
  border: "1px solid #232a31",
  borderRadius: 12,
  padding: 24,
  marginTop: 20,
}

// Derived from the actual request host by default, so a fresh deploy shows
// its own URL out of the box — NEXT_PUBLIC_MCP_URL only needed to override.
async function mcpUrl() {
  if (process.env.NEXT_PUBLIC_MCP_URL) return process.env.NEXT_PUBLIC_MCP_URL
  const h = await headers()
  const host = h.get("host")
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}/api/mcp`
}

export const metadata = {
  title: "gregaria-mcp",
}

export default async function Home() {
  const url = await mcpUrl()
  return (
    <main style={card}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>gregaria-mcp</h1>
      <p style={{ color: "#9aa4af", marginTop: 0 }}>
        Remote MCP server for Intervals.icu, for Claude and other AI assistants.
      </p>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Connect</h3>
        <p style={{ color: "#c3cad2" }}>
          <a
            href="https://claude.ai/customize/connectors?modal=add-custom-connector"
            style={{ color: "#3b82f6" }}
          >
            Add custom connector in Claude →
          </a>
        </p>
        <p style={{ color: "#c3cad2" }}>Paste this URL:</p>
        <p style={{ color: "#e8eaed", fontFamily: "monospace" }}>{url}</p>
        <p style={{ color: "#c3cad2" }}>
          Connecting will ask you to log in to Intervals.icu and authorize access. No account or
          signup here — this server doesn't store anything.
        </p>
      </div>

      <p style={{ marginTop: 20 }}>
        <a href="/privacy" style={{ color: "#3b82f6" }}>Privacy Policy</a>
      </p>
    </main>
  )
}
