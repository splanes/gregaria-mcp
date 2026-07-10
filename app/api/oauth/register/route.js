// Dynamic Client Registration (RFC 7591). Claude registra su client_id acá
// cuando no hay uno preconfigurado. Cliente público (PKCE, sin secret).
import { registerClient } from "../../../../lib/oauth.js"

export const runtime = "nodejs"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
}

export async function POST(req) {
  let body = {}
  try {
    body = await req.json()
  } catch {
    // cuerpo vacío o inválido → registramos sin redirect_uris
  }
  const redirect_uris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
  const rec = await registerClient({ redirect_uris, client_name: body.client_name })

  return Response.json(
    {
      client_id: rec.client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      ...(rec.client_name ? { client_name: rec.client_name } : {}),
    },
    { status: 201, headers: { ...CORS, "cache-control": "no-store" } }
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
