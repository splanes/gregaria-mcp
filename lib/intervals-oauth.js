// Server-to-server OAuth client against Intervals.icu's Authorization Server.
// Only used in AUTH_MODE=proxy (see lib/oauth.js and app/api/oauth/*). We never
// persist what it returns — it's relayed as-is to Claude in the same request.
//
// URLs are configurable via env because as of this code the exact details of
// Intervals.icu's OAuth aren't confirmed yet (pending their reply) — adjust
// INTERVALS_OAUTH_* once confirmed.
const AUTHORIZE_URL =
  process.env.INTERVALS_OAUTH_AUTHORIZE_URL || "https://intervals.icu/oauth/authorize"
const TOKEN_URL = process.env.INTERVALS_OAUTH_TOKEN_URL || "https://intervals.icu/api/oauth/token"

// Real scope taxonomy, confirmed at forum.intervals.icu/t/intervals-icu-oauth-support/2759:
// ACTIVITY, WELLNESS, CALENDAR, CHATS, LIBRARY, SETTINGS — each with :READ/:WRITE,
// and WRITE implies READ. We request WRITE for every category some tool needs to
// write to, so we cover read+write without listing READ separately:
//   ACTIVITY  → get/update/delete activities, intervals, streams (activities.js)
//   WELLNESS  → get/update_wellness (wellness.js)
//   CALENDAR  → get/add/delete events — the "planned workouts" (events.js)
//   CHATS     → post/get_activity_messages (activities.js)
//   SETTINGS  → get/update_athlete_sport_settings, get_athlete_info (athlete.js)
// LIBRARY isn't requested: no tool touches the workout library. Coach mode
// (multi-athlete, GET /athletes) is left without a confirmed scope — one of the
// open questions for Intervals.icu; that's why there are no multi-athlete
// listing tools today.
export const DEFAULT_SCOPE =
  process.env.INTERVALS_OAUTH_SCOPE ||
  "ACTIVITY:WRITE,WELLNESS:WRITE,CALENDAR:WRITE,CHATS:WRITE,SETTINGS:WRITE"

function clientId() {
  const id = process.env.INTERVALS_CLIENT_ID
  if (!id) throw new Error("INTERVALS_CLIENT_ID not set")
  return id
}
function clientSecret() {
  const s = process.env.INTERVALS_CLIENT_SECRET
  if (!s) throw new Error("INTERVALS_CLIENT_SECRET not set")
  return s
}

// Our own callback (registered with Intervals' OAuth app), not Claude's.
export function ourCallbackUrl(base) {
  return `${base}/api/oauth/callback`
}

export function buildAuthorizeUrl({ base, state, scope }) {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set("client_id", clientId())
  url.searchParams.set("redirect_uri", ourCallbackUrl(base))
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", scope || DEFAULT_SCOPE)
  url.searchParams.set("state", state)
  return url.toString()
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      ...params,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`Intervals token endpoint returned a non-JSON response (${res.status})`)
  }
  if (!res.ok) {
    throw new Error(`Intervals token endpoint error ${res.status}: ${body.error || text}`)
  }
  return body
}

// Exchanges Intervals' code for its token. Returns the body as-is (never
// logged or persisted here — the caller relays it straight to Claude).
export function exchangeCode({ code, base }) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: ourCallbackUrl(base),
  })
}

// Note (forum.intervals.icu/t/intervals-icu-oauth-support/2759): as of now, Intervals.icu
// doesn't issue refresh tokens, only access tokens — this grant will probably never be used
// in practice, but it's kept in case they add it; if unsupported, Intervals.icu will return
// an error here and we relay it as invalid_grant (see app/api/oauth/token/route.js).
export function refreshToken(refresh_token) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token })
}
