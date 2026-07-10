// Protected Resource Metadata (RFC 9728). Le dice a Claude cuál es el AS.
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
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      scopes_supported: ["intervals:read"],
    },
    { headers: CORS }
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
