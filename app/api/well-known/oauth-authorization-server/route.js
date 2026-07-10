// Authorization Server Metadata (RFC 8414). Publica los endpoints del AS.
import { baseUrl } from "../../../../lib/oauth.js"

export const runtime = "nodejs"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
}

export async function GET(req) {
  const base = baseUrl(req)
  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["intervals:read"],
    },
    { headers: CORS }
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
