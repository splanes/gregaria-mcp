// Servidor MCP remoto (streamable HTTP) para la app de Claude.
// Endpoint público: https://mcp.gregaria.app/api/mcp
//
// Flujo: Bearer → getByToken → decrypt(enc_key) → tools con {athleteId, apiKey} en el contexto.
// Auth requerida (401 sin token válido). Rate-limit por token (429).
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { registerTools } from "../../../lib/tools/index.js"
import { getByToken } from "../../../lib/store.js"
import { decrypt } from "../../../lib/crypto.js"
import { allow } from "../../../lib/ratelimit.js"

export const runtime = "nodejs"
export const maxDuration = 60

const mcpHandler = createMcpHandler(
  (server) => registerTools(server),
  {},
  { basePath: "/api" }
)

// Resuelve el Bearer → contexto del atleta. undefined = 401.
async function verifyToken(_req, bearerToken) {
  if (!bearerToken) return undefined
  const row = await getByToken(bearerToken)
  if (!row) return undefined
  let apiKey
  try {
    apiKey = decrypt(row.enc_key)
  } catch {
    return undefined
  }
  return {
    token: bearerToken,
    clientId: row.athlete_id,
    scopes: [],
    extra: { athleteId: row.athlete_id, apiKey },
  }
}

const authHandler = withMcpAuth(mcpHandler, verifyToken, { required: true })

function bearerFrom(req) {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

async function handler(req, ctx) {
  const tok = bearerFrom(req)
  if (tok) {
    const allowed = await allow(tok)
    if (!allowed) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "60" },
      })
    }
  }
  return authHandler(req, ctx)
}

export { handler as GET, handler as POST, handler as DELETE }
