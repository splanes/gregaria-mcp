const card = { maxWidth: 680, margin: "0 auto", padding: "40px 24px", lineHeight: 1.7 }
const box = {
  background: "#14181d",
  border: "1px solid #232a31",
  borderRadius: 12,
  padding: 24,
  marginTop: 20,
}

export const metadata = {
  title: "Privacy Policy · gregaria-mcp",
}

export default function Privacy() {
  return (
    <main style={card}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ color: "#9aa4af", marginTop: 0 }}>Last updated: July 2026</p>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>What this is</h3>
        <p style={{ color: "#c3cad2" }}>
          gregaria-mcp is a protocol adapter: it exposes your Intervals.icu training data (activities,
          wellness, power curve, calendar, etc.) to AI assistants that speak the Model Context Protocol
          (MCP) — such as Claude and ChatGPT — using the credentials you provide. It does not have its
          own product surface beyond that bridge.
        </p>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>What data passes through</h3>
        <p style={{ color: "#c3cad2" }}>
          When you ask your AI assistant a question, it calls this server, which calls the Intervals.icu
          API on your behalf and returns the response. That training data passes through in memory to
          fulfill your request and is not retained, logged, or used for any other purpose.
        </p>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>What we store today</h3>
        <p style={{ color: "#c3cad2" }}>
          This project is currently a small closed beta (a handful of manually-approved accounts). For
          that beta, we store:
        </p>
        <ul style={{ color: "#c3cad2" }}>
          <li>Your Google account email, used only to gate access to a manual allow-list.</li>
          <li>Your Intervals.icu athlete ID.</li>
          <li>Your Intervals.icu API key, <b>encrypted at rest</b> (AES-256-GCM) — never logged, never
            shown again after you paste it, never shared with the AI provider (Claude/ChatGPT never see it).</li>
        </ul>
        <p style={{ color: "#c3cad2" }}>
          This exists solely to authenticate requests to the Intervals.icu API on your behalf. We don't
          sell, share, or use it for advertising or analytics of any kind.
        </p>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Where this is going</h3>
        <p style={{ color: "#c3cad2" }}>
          We're moving to authenticate directly against Intervals.icu's own OAuth, so this server stops
          storing any credentials at all — it becomes a stateless adapter between Intervals.icu's OAuth
          and MCP-compatible AI clients, with no account storage on our side.
        </p>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Deleting your data</h3>
        <p style={{ color: "#c3cad2" }}>
          Email <a style={{ color: "#60a5fa" }} href="mailto:sebastian.planes@gmail.com">sebastian.planes@gmail.com</a>{" "}
          at any time to have your account and stored key permanently deleted.
        </p>
      </div>
    </main>
  )
}
