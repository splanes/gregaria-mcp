// OAuth helpers shared by both modes (AUTH_MODE=passthrough|proxy).
// There's no more Authorization Server of our own holding credentials: in
// passthrough Claude talks directly to Intervals.icu; in proxy we relay the
// code/token exchange without persisting anything (see lib/seal.js, lib/intervals-oauth.js).
import { createHash, timingSafeEqual } from "crypto"

// Real request origin (supports custom domain + preview deploys). Falls back
// to AUTH_URL only if req.url can't be parsed — no hardcoded domain, so a
// fresh deploy never silently points at someone else's instance.
export function baseUrl(req) {
  try {
    return new URL(req.url).origin
  } catch {
    if (process.env.AUTH_URL) return process.env.AUTH_URL
    throw new Error("Could not determine base URL from the request; set AUTH_URL")
  }
}

export function authMode() {
  return process.env.AUTH_MODE === "proxy" ? "proxy" : "passthrough"
}

// ── PKCE S256 ─────────────────────────────────────────────────────────────────
export function verifyPkce(codeVerifier, codeChallenge, method = "S256") {
  if (!codeVerifier || !codeChallenge || method !== "S256") return false
  const hashed = createHash("sha256").update(codeVerifier).digest("base64url")
  const a = Buffer.from(hashed)
  const b = Buffer.from(codeChallenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Anti open-redirect: only trusted hosts (Claude/Anthropic + localhost for dev,
// + the homelab's Open WebUI, which connects as an MCP client against the
// self-hosted proxy-mode instance — see gregaria-mcp.splanes.com.ar).
// We don't rely on a persisted client registry: any client talking to our proxy
// AS can only be one of these, so we validate by host instead.
export function isTrustedRedirect(uri) {
  if (!uri) return false
  try {
    const u = new URL(uri)
    const h = u.hostname
    if (u.protocol !== "https:" && h !== "localhost") return false
    return (
      h === "claude.ai" ||
      h.endsWith(".claude.ai") ||
      h === "claude.com" ||
      h.endsWith(".claude.com") ||
      h === "chat.splanes.com.ar" ||
      h === "localhost"
    )
  } catch {
    return false
  }
}
