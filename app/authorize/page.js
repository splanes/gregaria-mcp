// Authorization endpoint (UI). Claude manda acá al usuario con los params OAuth.
// Gatea por Google login + allowlist, muestra consent (o enroll la 1ª vez), y el
// form postea a /api/oauth/authorize, que emite el code y redirige de vuelta.
import { auth, signIn, isEmailAllowed } from "../../auth.js"
import { getAccount } from "../../lib/oauth.js"

const card = { maxWidth: 620, margin: "0 auto", padding: "40px 24px" }
const box = {
  background: "#14181d",
  border: "1px solid #232a31",
  borderRadius: 12,
  padding: 24,
  marginTop: 20,
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

function Shell({ children }) {
  return (
    <main style={card}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Conectar Claude a Intervals.icu</h1>
      <p style={{ color: "#9aa4af", marginTop: 0 }}>Acceso de solo lectura a tus datos de entrenamiento.</p>
      <div style={box}>{children}</div>
    </main>
  )
}

export default async function Authorize({ searchParams }) {
  const sp = await searchParams
  const params = {
    response_type: sp.response_type,
    client_id: sp.client_id,
    redirect_uri: sp.redirect_uri,
    code_challenge: sp.code_challenge,
    code_challenge_method: sp.code_challenge_method,
    state: sp.state,
    scope: sp.scope,
  }

  if (params.response_type !== "code" || !params.code_challenge || !params.redirect_uri) {
    return (
      <Shell>
        <p style={{ color: "#fca5a5" }}>Solicitud OAuth inválida o incompleta.</p>
      </Shell>
    )
  }

  // URL propia (para volver acá después del login de Google).
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  const selfUrl = `/authorize?${qs.toString()}`

  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    return (
      <Shell>
        <p>Para conectar, entrá con tu Google (el email que Sebastián habilitó):</p>
        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: selfUrl })
          }}
        >
          <button style={btn} type="submit">Entrar con Google</button>
        </form>
      </Shell>
    )
  }

  if (!isEmailAllowed(email)) {
    return (
      <Shell>
        <p style={{ color: "#fca5a5" }}>
          Tu email (<b>{email}</b>) no está habilitado. Pedile a Sebastián que te agregue.
        </p>
      </Shell>
    )
  }

  const acct = await getAccount(email)
  const hidden = Object.entries(params).map(([k, v]) =>
    v ? <input key={k} type="hidden" name={k} value={v} /> : null
  )

  return (
    <Shell>
      <p style={{ marginTop: 0 }}>
        Conectado como <b>{email}</b>. Claude va a poder <b>leer</b> tus datos de Intervals.icu (nunca escribir).
      </p>

      {acct ? (
        <form method="post" action="/api/oauth/authorize">
          {hidden}
          <p style={{ color: "#c3cad2" }}>Atleta: <b>{acct.athlete_id}</b></p>
          <button style={btn} type="submit">Autorizar</button>
        </form>
      ) : (
        <form method="post" action="/api/oauth/authorize">
          {hidden}
          <p style={{ color: "#c3cad2" }}>
            Primera vez: pegá tu <b>API Key</b> de Intervals y tu <b>Athlete ID</b>.
            <br />
            <span style={{ color: "#9aa4af", fontSize: 13 }}>
              intervals.icu → Settings → Developer Settings → API Key. El Athlete ID es el <code>iXXXXX</code> de tu perfil.
            </span>
          </p>
          <label style={{ fontSize: 13, color: "#c3cad2", display: "block" }}>
            Athlete ID
            <input style={input} name="athleteId" placeholder="i218573" required />
          </label>
          <label style={{ fontSize: 13, color: "#c3cad2", display: "block", marginTop: 14 }}>
            API Key de Intervals
            <input style={input} name="apiKey" type="password" placeholder="pegá tu API key" required />
          </label>
          <button style={btn} type="submit">Conectar</button>
        </form>
      )}
    </Shell>
  )
}
