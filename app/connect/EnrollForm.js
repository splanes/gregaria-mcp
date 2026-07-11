"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

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
const link = { color: "#60a5fa", cursor: "pointer", background: "none", border: "none", padding: 0, fontSize: 13 }

export default function EnrollForm({ athleteId }) {
  const router = useRouter()
  const [editing, setEditing] = useState(!athleteId)
  const [inputAthleteId, setInputAthleteId] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [done, setDone] = useState(false)
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
        body: JSON.stringify({ athleteId: inputAthleteId.trim(), apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error")
      setApiKey("")
      setDone(true)
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <p style={{ color: "#86efac", marginBottom: 4 }}>
          ✓ Cuenta conectada (atleta <b>{athleteId}</b>){done && " — listo"}
        </p>
        <button style={link} type="button" onClick={() => setEditing(true)}>
          Actualizar API key / cambiar atleta
        </button>
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
          value={inputAthleteId}
          onChange={(e) => setInputAthleteId(e.target.value)}
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
        {busy ? "Conectando…" : "Conectar cuenta"}
      </button>
    </form>
  )
}
