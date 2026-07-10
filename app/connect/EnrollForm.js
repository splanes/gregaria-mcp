"use client"
import { useState } from "react"

const input = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0b0d10",
  border: "1px solid #2a323a",
  borderRadius: 8,
  color: "#e8eaed",
  padding: "10px 12px",
  fontSize: 14,
  marginTop: 6,
}
const btn = {
  background: "#3b82f6",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontSize: 15,
  cursor: "pointer",
  marginTop: 14,
}
const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13,
  wordBreak: "break-all",
}

export default function EnrollForm({ mcpUrl }) {
  const [athleteId, setAthleteId] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ athleteId: athleteId.trim(), apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error")
      setToken(data.token)
      setApiKey("")
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (token) {
    return (
      <div>
        <p style={{ color: "#86efac" }}>✓ Listo. Copiá tu token (se muestra una sola vez):</p>
        <div style={{ ...input, ...mono, marginTop: 4 }}>{token}</div>

        <h4 style={{ marginBottom: 4 }}>3 · Agregá el connector en Claude</h4>
        <p style={{ color: "#c3cad2", lineHeight: 1.6, margin: "4px 0" }}>
          App de Claude → <b>Settings → Connectors → Add custom connector</b>:
        </p>
        <div style={{ marginTop: 8 }}>
          <div style={{ color: "#9aa4af", fontSize: 12 }}>URL</div>
          <div style={{ ...input, ...mono }}>{mcpUrl}</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ color: "#9aa4af", fontSize: 12 }}>Header</div>
          <div style={{ ...input, ...mono }}>Authorization: Bearer {token}</div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <label style={{ fontSize: 13, color: "#c3cad2" }}>
        Athlete ID
        <input
          style={input}
          placeholder="i218573"
          value={athleteId}
          onChange={(e) => setAthleteId(e.target.value)}
          required
        />
      </label>
      <label style={{ fontSize: 13, color: "#c3cad2", display: "block", marginTop: 14 }}>
        API Key de Intervals
        <input
          style={input}
          type="password"
          placeholder="pegá tu API key acá"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
        />
      </label>
      {error && <p style={{ color: "#fca5a5", marginBottom: 0 }}>{error}</p>}
      <button style={btn} type="submit" disabled={busy}>
        {busy ? "Generando…" : "Generar mi token"}
      </button>
    </form>
  )
}
