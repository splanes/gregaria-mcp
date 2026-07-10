import { auth, signIn, signOut } from "../../auth.js"
import EnrollForm from "./EnrollForm.js"

const card = {
  maxWidth: 620,
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

export default async function Connect({ searchParams }) {
  const sp = await searchParams
  const denied = sp?.denied
  const session = await auth()
  const mcpUrl = process.env.NEXT_PUBLIC_MCP_URL || "https://mcp.gregaria.app/api/mcp"

  return (
    <main style={card}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Conectá tu Claude a Intervals.icu</h1>
      <p style={{ color: "#9aa4af", marginTop: 0 }}>
        Generá tu token privado para preguntarle a la app de Claude por tus datos de entrenamiento.
      </p>

      {denied && (
        <div style={{ ...box, borderColor: "#7f1d1d", background: "#1c1416" }}>
          Tu email no está habilitado. Pedile a Sebastián que te agregue a la lista.
        </div>
      )}

      {!session ? (
        <div style={box}>
          <p>Primero entrá con tu Google (el mismo email que Sebastián habilitó):</p>
          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: "/connect" })
            }}
          >
            <button style={btn} type="submit">Entrar con Google</button>
          </form>
        </div>
      ) : (
        <>
          <div style={{ ...box, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Conectado como <b>{session.user?.email}</b></span>
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/connect" })
              }}
            >
              <button style={{ ...btn, background: "#374151" }} type="submit">Salir</button>
            </form>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>1 · Tu API key de Intervals.icu</h3>
            <ol style={{ lineHeight: 1.7, color: "#c3cad2" }}>
              <li>Entrá a <a style={{ color: "#60a5fa" }} href="https://intervals.icu" target="_blank" rel="noreferrer">intervals.icu</a> y logueate.</li>
              <li>Avatar (arriba a la derecha) → <b>Settings</b>.</li>
              <li>Bajá hasta <b>Developer Settings</b> (casi al final).</li>
              <li>Copiá tu <b>API Key</b> (botón <i>Show</i>). Si no hay, se genera sola.</li>
              <li>Anotá tu <b>Athlete ID</b>: el <code>iXXXXX</code> de la URL de tu perfil.</li>
            </ol>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>2 · Generá tu token</h3>
            <EnrollForm mcpUrl={mcpUrl} />
          </div>
        </>
      )}
    </main>
  )
}
