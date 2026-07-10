// Enroll web self-serve. Gateado por Google login + allowlist (auth.js).
// La API key va browser → server → cifrado; nunca se loguea ni se devuelve.
import { auth } from "../../../auth.js"
import { enroll, revoke } from "../../../lib/enroll.js"
import { encrypt } from "../../../lib/crypto.js"
import { putAccount } from "../../../lib/oauth.js"

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export async function POST(req) {
  const session = await auth()
  if (!session?.user?.email) return json({ error: "No autenticado" }, 401)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: "JSON inválido" }, 400)
  }

  const { athleteId, apiKey, name } = body || {}
  try {
    const { token } = await enroll({
      name: name || session.user.name || session.user.email,
      athleteId,
      apiKey,
    })
    // Además de la fila del token, dejamos la cuenta por email para que el
    // flujo OAuth (Connect desde la app) reutilice esta key sin re-pedirla.
    await putAccount(session.user.email, {
      athlete_id: String(athleteId).trim(),
      name: name || session.user.name || session.user.email,
      enc_key: encrypt(apiKey.trim()),
    })
    return json({ token })
  } catch (e) {
    return json({ error: e.message }, 400)
  }
}

// Auto-revocación: pegás tu token y lo das de baja. No requiere sesión (tener el token ya prueba posesión).
export async function DELETE(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: "JSON inválido" }, 400)
  }
  const ok = await revoke(body?.token)
  return json({ revoked: ok })
}
