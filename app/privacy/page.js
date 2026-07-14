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
          (MCP) — such as Claude and ChatGPT. You authorize access directly with Intervals.icu via
          OAuth; this server never sees, stores, or logs your Intervals.icu credentials. It does not
          have its own product surface beyond that bridge.
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
        <h3 style={{ marginTop: 0 }}>No storage</h3>
        <p style={{ color: "#c3cad2" }}>
          We do not store, log, or retain your Intervals.icu access token, activities, or wellness data
          on our servers. This app is designed to be a stateless bridge: requests pass through in real
          time and nothing persists here beyond the lifetime of the request. We don't sell, share, or
          use your data for advertising or analytics of any kind.
        </p>
      </div>
    </main>
  )
}
