// Dynamic Client Registration (RFC 7591), AUTH_MODE=proxy only. Public client
// (PKCE, no secret). No storage: client_id is a random value that isn't saved
// anywhere — no need to, because /authorize and /token validate redirect_uri
// against trusted hosts (isTrustedRedirect), not against a client registry.
// In practice only Claude will ever talk to this AS.
import { randomBytes } from "crypto"

export const runtime = "nodejs"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
}

export async function POST(req) {
  const isProxy = process.env.AUTH_MODE === "proxy"
  if (!isProxy) return new Response("Not found", { status: 404 })

  let body = {}
  try {
    body = await req.json()
  } catch {
    // empty or invalid body → register without redirect_uris
  }
  const redirect_uris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
  const client_id = "mcpc_" + randomBytes(16).toString("base64url")

  return Response.json(
    {
      client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      ...(body.client_name ? { client_name: body.client_name } : {}),
    },
    { status: 201, headers: { ...CORS, "cache-control": "no-store" } }
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
