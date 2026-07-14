// Helpers shared by all tools: auth context, athlete_id resolution
// (coach mode), response wrapper, and error handling.
import { z } from "zod"

// Confirms there's a valid Bearer in the context. `apiKey` here is actually
// the Intervals.icu OAuth access token forwarded by Claude (stateless relay) —
// the name is kept so we don't have to touch every tools/intervals/*.js that passes it.
export function ctx(extra) {
  const info = extra?.authInfo?.extra
  if (!info?.apiKey) {
    throw new Error("Not authenticated: missing Bearer in the request")
  }
  return info
}

// "0" is Intervals.icu's special id that resolves to the athlete who owns the
// API key used in the call (Basic Auth) — see forum.intervals.icu/t/api-access-to-intervals-icu/609.
// Avoids depending on an athleteId cached in the token: works the same for a
// solo athlete or for a coach with multiple athletes.
export function resolveAthleteId(args) {
  return args?.athlete_id || "0"
}

// Zod fragment to carry coach-mode support without duplicating code in every tool.
// The regex is only for when the caller passes an explicit id; "0" is the
// internal default and not something the model is asked to write.
export const athleteIdArg = {
  athlete_id: z.string().regex(/^i\d+$/).optional()
    .describe("Athlete ID (e.g. i12345) for coach mode. If omitted, uses the athlete who owns the token's API key."),
}

export function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
}

export async function run(fn) {
  try {
    return ok(await fn())
  } catch (e) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${e.message}` }],
    }
  }
}
