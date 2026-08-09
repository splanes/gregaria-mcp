// Remote MCP server (streamable HTTP) for the Claude app.
// Served at /api/mcp on whatever domain this is deployed to.
//
// Two ways in, both ending up as a plain Bearer header on this same endpoint:
//   - OAuth passthrough/proxy (Claude): the Bearer sent IS ALREADY Intervals.icu's
//     access token (Anthropic holds it — see AUTH_MODE in lib/oauth.js). Passed
//     as-is to the tools, which use it as the credential against Intervals.icu.
//   - API-key mode (`?auth=apikey`, e.g. Open WebUI): the Bearer is the user's
//     personal Intervals.icu API key instead of an OAuth token — no OAuth dance,
//     just a static header the client sends on every request. Tagged with
//     API_KEY_PREFIX so lib/intervals/client.js knows to send it as HTTP Basic
//     auth (what Intervals.icu actually requires for personal keys), not Bearer.
// Either way: no lookup or decrypt here, nothing persisted or logged.
// Auth required (401 without a token).
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { registerTools } from "../../../lib/tools/index.js"
import { API_KEY_PREFIX } from "../../../lib/intervals/client.js"

export const runtime = "nodejs"
export const maxDuration = 60

const mcpHandler = createMcpHandler(
  (server) => registerTools(server),
  {},
  { basePath: "/api" }
)

// undefined = 401. No further validation is possible here: if the token/key is
// invalid, Intervals.icu will reject it on the first real call (401 from their API).
async function verifyToken(req, bearerToken) {
  if (!bearerToken) return undefined
  const isApiKeyMode = new URL(req.url).searchParams.get("auth") === "apikey"
  return {
    token: bearerToken,
    clientId: undefined,
    scopes: [],
    extra: { apiKey: isApiKeyMode ? API_KEY_PREFIX + bearerToken : bearerToken },
  }
}

const handler = withMcpAuth(mcpHandler, verifyToken, { required: true })

export { handler as GET, handler as POST, handler as DELETE }
