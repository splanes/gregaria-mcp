// Protected Resource Metadata (RFC 9728). Tells Claude which AS to use.
// passthrough: the AS is Intervals.icu directly (we never see the token).
// proxy: we are the AS (relaying the exchange, see app/api/oauth/*).
import { baseUrl, authMode } from "../../../../lib/oauth.js"
import { DEFAULT_SCOPE } from "../../../../lib/intervals-oauth.js"

export const runtime = "nodejs"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
}

const INTERVALS_ISSUER = process.env.INTERVALS_OAUTH_ISSUER || "https://intervals.icu"

export async function GET(req) {
  const base = baseUrl(req)
  const authorization_servers = authMode() === "proxy" ? [base] : [INTERVALS_ISSUER]
  return Response.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers,
      bearer_methods_supported: ["header"],
      scopes_supported: DEFAULT_SCOPE.split(","),
    },
    { headers: CORS }
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
