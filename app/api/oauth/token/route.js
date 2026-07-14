// Token endpoint of the proxy AS (AUTH_MODE=proxy only). Public client: doesn't
// require a client_secret from Claude, validates PKCE instead. The `code` we
// receive is our own sealed envelope (see /api/oauth/callback) — we unseal it,
// verify the code_verifier against the original code_challenge, and only then
// exchange Intervals.icu's real code for its access token (server-to-server,
// with our own client_id/secret). That token is returned to Claude AS-IS — never
// persisted or logged at any step.
import { authMode, verifyPkce } from "../../../../lib/oauth.js"
import { baseUrl } from "../../../../lib/oauth.js"
import { unseal } from "../../../../lib/seal.js"
import { exchangeCode, refreshToken } from "../../../../lib/intervals-oauth.js"

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
  if (authMode() !== "proxy") return err("not_found", 404)

  const ct = req.headers.get("content-type") || ""
  let params
  if (ct.includes("application/json")) {
    params = await req.json().catch(() => null)
  } else {
    const fd = await req.formData().catch(() => null)
    params = fd ? Object.fromEntries(fd) : null
  }
  if (!params) return err("invalid_request")

  const base = baseUrl(req)

  if (params.grant_type === "refresh_token") {
    if (!params.refresh_token) return err("invalid_request")
    try {
      const token = await refreshToken(params.refresh_token)
      return Response.json(token, { headers: { ...CORS, "cache-control": "no-store" } })
    } catch {
      return err("invalid_grant")
    }
  }

  if (params.grant_type !== "authorization_code") return err("unsupported_grant_type")

  let sealedCode
  try {
    sealedCode = unseal(params.code)
  } catch {
    return err("invalid_grant")
  }
  if (!verifyPkce(params.code_verifier, sealedCode.code_challenge)) return err("invalid_grant")

  try {
    const token = await exchangeCode({ code: sealedCode.intervals_code, base })
    return Response.json(token, { headers: { ...CORS, "cache-control": "no-store" } })
  } catch {
    return err("invalid_grant")
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
