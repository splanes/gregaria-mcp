// Finaliza la autorización: recibe el POST del formulario de /authorize
// (ya con sesión de Google), enrola si hace falta, emite el authorization_code
// y redirige a redirect_uri?code=...&state=...
import { auth, isEmailAllowed } from "../../../../auth.js"
import { encrypt } from "../../../../lib/crypto.js"
import {
  getAccount,
  putAccount,
  getClient,
  issueCode,
  isTrustedRedirect,
} from "../../../../lib/oauth.js"

export const runtime = "nodejs"

function bad(msg, status = 400) {
  return new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8" } })
}

export async function POST(req) {
  const session = await auth()
  const email = session?.user?.email
  if (!email || !isEmailAllowed(email)) return bad("No autorizado", 403)

  const fd = await req.formData()
  const p = Object.fromEntries(fd)
  const { response_type, client_id, redirect_uri, code_challenge, state, scope } = p
  const code_challenge_method = p.code_challenge_method || "S256"

  if (response_type !== "code") return bad("response_type inválido (se espera 'code')")
  if (!code_challenge || code_challenge_method !== "S256") return bad("PKCE S256 requerido")

  const client = await getClient(client_id)
  if (!isTrustedRedirect(redirect_uri, client)) return bad("redirect_uri no permitido")

  // ¿Ya tiene cuenta? Si mandó API key, (re)enrola.
  let acct = await getAccount(email)
  const apiKey = (p.apiKey || "").trim()
  const athleteId = (p.athleteId || "").trim()
  if (apiKey) {
    if (!/^i\d+$/.test(athleteId)) return bad("Athlete ID inválido: debe ser iXXXXX (ej. i218573)")
    if (apiKey.length < 10) return bad("API key inválida o vacía")
    const enc_key = encrypt(apiKey)
    await putAccount(email, { athlete_id: athleteId, name: session.user?.name || email, enc_key })
    acct = { athlete_id: athleteId, enc_key }
  }
  if (!acct) return bad("Falta enrolar: pegá tu API key de Intervals.")

  const code = await issueCode({
    email,
    athlete_id: acct.athlete_id,
    enc_key: acct.enc_key,
    code_challenge,
    code_challenge_method: "S256",
    redirect_uri,
    client_id: client_id || null,
    scope: scope || "intervals:read",
  })

  const url = new URL(redirect_uri)
  url.searchParams.set("code", code)
  if (state) url.searchParams.set("state", state)
  return Response.redirect(url.toString(), 302)
}
