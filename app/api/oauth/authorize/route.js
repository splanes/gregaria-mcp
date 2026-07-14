// Authorization endpoint of the proxy AS (AUTH_MODE=proxy only). No UI, no
// Google login: Claude arrives here with its OAuth+PKCE params, we seal them
// (see lib/seal.js — nothing is persisted) inside the `state` we send to
// Intervals.icu, and redirect. Intervals.icu is the one gating the athlete's login.
import { authMode, isTrustedRedirect } from "../../../../lib/oauth.js"
import { baseUrl } from "../../../../lib/oauth.js"
import { seal } from "../../../../lib/seal.js"
import { buildAuthorizeUrl } from "../../../../lib/intervals-oauth.js"

export const runtime = "nodejs"

const STATE_TTL = 600 // 10 min: time for the athlete to complete login on Intervals.icu

function bad(msg, status = 400) {
  return new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8" } })
}

export async function GET(req) {
  if (authMode() !== "proxy") return bad("Not found", 404)

  const sp = new URL(req.url).searchParams
  const response_type = sp.get("response_type")
  const redirect_uri = sp.get("redirect_uri")
  const code_challenge = sp.get("code_challenge")
  const code_challenge_method = sp.get("code_challenge_method") || "S256"
  const state = sp.get("state")
  const scope = sp.get("scope")

  if (response_type !== "code") return bad("invalid response_type (expected 'code')")
  if (!code_challenge || code_challenge_method !== "S256") return bad("PKCE S256 required")
  if (!isTrustedRedirect(redirect_uri)) return bad("redirect_uri not allowed")

  const base = baseUrl(req)
  const sealedState = seal({ redirect_uri, code_challenge, claude_state: state }, STATE_TTL)

  return Response.redirect(buildAuthorizeUrl({ base, state: sealedState, scope }), 302)
}
