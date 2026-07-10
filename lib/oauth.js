// Authorization Server propio (OAuth 2.1 + PKCE) para la app de Claude.
// El server ES el AS: /authorize gateado por Google login, /token emite el Bearer
// que después resuelve verifyToken (mismas filas mcp:tok del store).
//
// Registros en el KV:
//   mcp:acct:<email>   → { athlete_id, name, enc_key }   (custodia de la key por usuario)
//   mcp:client:<id>    → { redirect_uris, ... }           (dynamic client registration)
//   mcp:code:<code>    → { email, athlete_id, enc_key, code_challenge, redirect_uri, ... } (TTL 10min)
import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { kvSet, kvGet, kvDel, putRow } from "./store.js"
import { generateToken, hashToken } from "./crypto.js"

const ACCT = (e) => `mcp:acct:${String(e).toLowerCase()}`
const CLIENT = (id) => `mcp:client:${id}`
const CODE = (c) => `mcp:code:${c}`
const CODE_TTL = 600 // 10 min

// Origin real del request (soporta dominio custom + deploys de preview).
export function baseUrl(req) {
  try {
    return new URL(req.url).origin
  } catch {
    return process.env.AUTH_URL || "https://mcp.gregaria.app"
  }
}

// ── Cuentas (custodia de la API key, por email de Google) ─────────────────────
export async function getAccount(email) {
  return email ? kvGet(ACCT(email)) : null
}
export async function putAccount(email, { athlete_id, name, enc_key }) {
  await kvSet(ACCT(email), {
    athlete_id,
    name: name || null,
    enc_key,
    created_at: new Date().toISOString(),
  })
}

// ── Dynamic Client Registration (RFC 7591) ───────────────────────────────────
export async function registerClient({ redirect_uris = [], client_name } = {}) {
  const client_id = "mcpc_" + randomBytes(16).toString("base64url")
  const rec = {
    client_id,
    redirect_uris,
    client_name: client_name || null,
    created_at: new Date().toISOString(),
  }
  await kvSet(CLIENT(client_id), rec)
  return rec
}
export async function getClient(id) {
  return id ? kvGet(CLIENT(id)) : null
}

// ── Authorization codes (un solo uso, TTL corto) ──────────────────────────────
export async function issueCode(data) {
  const code = randomBytes(32).toString("base64url")
  await kvSet(CODE(code), { ...data, created_at: Date.now() }, CODE_TTL)
  return code
}
export async function consumeCode(code) {
  if (!code) return null
  const rec = await kvGet(CODE(code))
  if (rec) await kvDel(CODE(code)) // un solo uso
  return rec
}

// ── Access token (fila mcp:tok, misma forma que lee verifyToken) ──────────────
export async function issueAccessToken({ athlete_id, enc_key, email }) {
  const token = generateToken()
  await putRow(hashToken(token), {
    athlete_id,
    enc_key,
    email: email || null,
    created_at: new Date().toISOString(),
  })
  return token
}

// ── PKCE S256 ─────────────────────────────────────────────────────────────────
export function verifyPkce(codeVerifier, codeChallenge, method = "S256") {
  if (!codeVerifier || !codeChallenge || method !== "S256") return false
  const hashed = createHash("sha256").update(codeVerifier).digest("base64url")
  const a = Buffer.from(hashed)
  const b = Buffer.from(codeChallenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── Anti open-redirect: solo clients registrados o hosts de confianza ─────────
export function isTrustedRedirect(uri, client) {
  if (!uri) return false
  if (client?.redirect_uris?.includes(uri)) return true
  try {
    const u = new URL(uri)
    const h = u.hostname
    if (u.protocol !== "https:" && h !== "localhost") return false
    return (
      h === "claude.ai" ||
      h.endsWith(".claude.ai") ||
      h === "claude.com" ||
      h.endsWith(".claude.com") ||
      h === "localhost"
    )
  } catch {
    return false
  }
}
