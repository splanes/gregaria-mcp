// Token endpoint. Canjea el authorization_code (+ PKCE verifier) por el Bearer
// que después usa el MCP. Cliente público: no exige client_secret, valida PKCE.
import { consumeCode, issueAccessToken, verifyPkce } from "../../../../lib/oauth.js"

export const runtime = "nodejs"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
}

function err(code, status = 400) {
  return Response.json(
    { error: code },
    { status, headers: { ...CORS, "cache-control": "no-store" } }
  )
}

export async function POST(req) {
  const ct = req.headers.get("content-type") || ""
  let params
  if (ct.includes("application/json")) {
    params = await req.json().catch(() => null)
  } else {
    const fd = await req.formData().catch(() => null)
    params = fd ? Object.fromEntries(fd) : null
  }
  if (!params) return err("invalid_request")

  const { grant_type, code, code_verifier, redirect_uri } = params
  if (grant_type !== "authorization_code") return err("unsupported_grant_type")

  const rec = await consumeCode(code)
  if (!rec) return err("invalid_grant")
  if (rec.redirect_uri !== redirect_uri) return err("invalid_grant")
  if (!verifyPkce(code_verifier, rec.code_challenge, rec.code_challenge_method)) {
    return err("invalid_grant")
  }

  const token = await issueAccessToken({
    athlete_id: rec.athlete_id,
    enc_key: rec.enc_key,
    email: rec.email,
  })

  return Response.json(
    { access_token: token, token_type: "Bearer", scope: rec.scope || "intervals:read" },
    { headers: { ...CORS, "cache-control": "no-store" } }
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
