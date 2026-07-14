// Remote MCP server (streamable HTTP) for the Claude app.
// Served at /api/mcp on whatever domain this is deployed to.
//
// Stateless relay: the Bearer Claude sends IS ALREADY Intervals.icu's access token
// (Anthropic holds it — see AUTH_MODE in lib/oauth.js). No lookup or decrypt:
// it's passed as-is to the tools, which use it as the credential against Intervals.icu.
// Never persisted or logged. Auth required (401 without a token).
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { registerTools } from "../../../lib/tools/index.js"

export const runtime = "nodejs"
export const maxDuration = 60

const mcpHandler = createMcpHandler(
  (server) => registerTools(server),
  {},
  { basePath: "/api" }
)

// undefined = 401. No further validation is possible here: if the token is
// invalid, Intervals.icu will reject it on the first real call (401 from their API).
async function verifyToken(_req, bearerToken) {
  if (!bearerToken) return undefined
  return {
    token: bearerToken,
    clientId: undefined,
    scopes: [],
    extra: { apiKey: bearerToken },
  }
}

const handler = withMcpAuth(mcpHandler, verifyToken, { required: true })

export { handler as GET, handler as POST, handler as DELETE }
