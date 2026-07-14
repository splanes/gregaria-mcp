// Callback we register with Intervals.icu's OAuth app (AUTH_MODE=proxy only).
// Receives Intervals.icu's code + our sealed `state` (see /api/oauth/authorize),
// unseals it to recover Claude's original params, seals a new "code" of our own
// (wrapping Intervals' code + Claude's code_challenge) and redirects back to
// Claude. None of this is persisted — all state travels encrypted in the URL.
import { authMode } from "../../../../lib/oauth.js"
import { seal, unseal } from "../../../../lib/seal.js"

export const runtime = "nodejs"

const CODE_TTL = 300 // 5 min: time for Claude to redeem the code at /api/oauth/token

function bad(msg, status = 400) {
  return new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8" } })
}

export async function GET(req) {
  if (authMode() !== "proxy") return bad("Not found", 404)

  const sp = new URL(req.url).searchParams
  const intervalsCode = sp.get("code")
  const sealedState = sp.get("state")
  const upstreamError = sp.get("error")

  if (!sealedState) return bad("Missing state")

  let claude
  try {
    claude = unseal(sealedState)
  } catch {
    return bad("Invalid or expired state", 400)
  }

  if (upstreamError) {
    const url = new URL(claude.redirect_uri)
    url.searchParams.set("error", upstreamError)
    if (claude.claude_state) url.searchParams.set("state", claude.claude_state)
    return Response.redirect(url.toString(), 302)
  }
  if (!intervalsCode) return bad("Missing code from Intervals.icu")

  const outboundCode = seal(
    { intervals_code: intervalsCode, code_challenge: claude.code_challenge },
    CODE_TTL
  )

  const url = new URL(claude.redirect_uri)
  url.searchParams.set("code", outboundCode)
  if (claude.claude_state) url.searchParams.set("state", claude.claude_state)
  return Response.redirect(url.toString(), 302)
}
