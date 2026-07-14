// Authorization Server Metadata (RFC 8414). Only applies in AUTH_MODE=proxy:
// that's when we ARE an AS (one that relays to Intervals.icu, see app/api/oauth/*).
// In passthrough we don't exist as an AS — Claude discovers Intervals.icu's via
// oauth-protected-resource and this endpoint shouldn't be used (404).
import { baseUrl, authMode } from "../../../../lib/oauth.js"
import { DEFAULT_SCOPE } from "../../../../lib/intervals-oauth.js"

export const runtime = "nodejs"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
}

export async function GET(req) {
  if (authMode() !== "proxy") {
    return new Response("Not found (AUTH_MODE=passthrough: we aren't the AS)", { status: 404 })
  }
  const base = baseUrl(req)
  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: DEFAULT_SCOPE.split(","),
    },
    { headers: CORS }
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
