import { auth, signIn, signOut } from "../../auth.js"
import { getAccount } from "../../lib/oauth.js"
import EnrollForm from "./EnrollForm.js"

const card = {
  maxWidth: 680,
  margin: "0 auto",
  padding: "40px 24px",
}
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
}
const btnDisabled = {
  ...btn,
  background: "#374151",
  color: "#8a929c",
  cursor: "not-allowed",
}
const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13,
  wordBreak: "break-all",
}
const cardsWrap = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginTop: 8,
}
const connectorCard = {
  background: "#0b0d10",
  border: "1px solid #2a323a",
  borderRadius: 10,
  padding: 18,
}

export default async function Connect({ searchParams }) {
  const sp = await searchParams
  const denied = sp?.denied
  const session = await auth()
  const mcpUrl = process.env.NEXT_PUBLIC_MCP_URL || "https://mcp.gregaria.app/api/mcp"
  const email = session?.user?.email
  const acct = email ? await getAccount(email) : null

  return (
    <main style={card}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Conectá tu Claude a Intervals.icu</h1>
      <p style={{ color: "#9aa4af", marginTop: 0 }}>
        Preguntale a Claude o ChatGPT por tus datos de entrenamiento, sin depender de tu PC prendida.
      </p>

      {denied && (
        <div style={{ ...box, borderColor: "#7f1d1d", background: "#1c1416" }}>
          Tu email no está habilitado. Pedile a Sebastián que te agregue a la lista.
        </div>
      )}

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>1 · Iniciá sesión</h3>
        {!session ? (
          <>
            <p style={{ color: "#c3cad2" }}>Entrá con tu Google (el mismo email que Sebastián habilitó):</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <form
                action={async () => {
                  "use server"
                  await signIn("google", { redirectTo: "/connect" })
                }}
              >
                <button style={btn} type="submit">Continuar con Google</button>
              </form>
              <button style={btnDisabled} type="button" disabled title="OAuth directo con Intervals.icu — en camino">
                Continuar con Intervals.icu (Próximamente)
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#c3cad2" }}>Conectado como <b>{email}</b></span>
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/connect" })
              }}
            >
              <button style={{ ...btn, background: "#374151" }} type="submit">Salir</button>
            </form>
          </div>
        )}
      </div>

      {session && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>2 · Conectá tu cuenta de Intervals.icu</h3>
          {!acct && (
            <ol style={{ lineHeight: 1.7, color: "#c3cad2" }}>
              <li>Entrá a <a style={{ color: "#60a5fa" }} href="https://intervals.icu" target="_blank" rel="noreferrer">intervals.icu</a> y logueate.</li>
              <li>Avatar (arriba a la derecha) → <b>Settings</b>.</li>
              <li>Bajá hasta <b>Developer Settings</b> (casi al final).</li>
              <li>Copiá tu <b>API Key</b> (botón <i>Show</i>). Si no hay, se genera sola.</li>
              <li>Anotá tu <b>Athlete ID</b>: el <code>iXXXXX</code> de la URL de tu perfil.</li>
            </ol>
          )}
          <EnrollForm athleteId={acct?.athlete_id} />
        </div>
      )}

      {session && acct && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>3 · Agregá el connector</h3>
          <p style={{ color: "#9aa4af", marginTop: 0 }}>
            Es OAuth: en las dos apps alcanza con pegar la URL y dejar Client ID/Secret vacíos.
            Cuando conectes, te va a redirigir acá para confirmar con tu Google — no hace falta copiar ningún token a mano.
          </p>
          <div style={cardsWrap}>
            <div style={connectorCard}>
              <h4 style={{ marginTop: 0 }}>Claude</h4>
              <ol style={{ lineHeight: 1.7, color: "#c3cad2", paddingLeft: 20, fontSize: 14 }}>
                <li>
                  Abrí{" "}
                  <a style={{ color: "#60a5fa" }} href="https://claude.ai/customize/connectors?modal=add-custom-connector" target="_blank" rel="noreferrer">
                    Configuración → Conectores → Agregar conector personalizado
                  </a>.
                </li>
                <li>Pegá esta URL:<div style={{ ...mono, marginTop: 4 }}>{mcpUrl}</div></li>
                <li>Dejá <b>Client ID</b> y <b>Client Secret</b> vacíos.</li>
                <li>Guardá y conectate.</li>
              </ol>
            </div>

            <div style={connectorCard}>
              <h4 style={{ marginTop: 0 }}>ChatGPT / Codex</h4>
              <p style={{ color: "#9aa4af", fontSize: 12, marginTop: -6 }}>
                No lo probamos en producción todavía — puede necesitar ajustes.
              </p>
              <ol style={{ lineHeight: 1.7, color: "#c3cad2", paddingLeft: 20, fontSize: 14 }}>
                <li>
                  Requiere plan pago (Plus/Pro/Team/Enterprise) — el plan free no tiene{" "}
                  <a style={{ color: "#60a5fa" }} href="https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt" target="_blank" rel="noreferrer">
                    Developer Mode
                  </a>.
                </li>
                <li>Configuración → Conectores → Avanzado → activá <b>Developer Mode</b>.</li>
                <li>Conectores → <b>Crear</b> → pegá esta URL, método de auth <b>OAuth</b>:<div style={{ ...mono, marginTop: 4 }}>{mcpUrl}</div></li>
                <li>Guardá y conectate. (Codex CLI/IDE: mismo servidor MCP remoto, mismo URL.)</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
