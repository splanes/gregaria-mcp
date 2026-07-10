// Rate-limit por token. Si no hay Upstash configurado (dev), es no-op.
let _limiter = null
let _resolved = false

async function limiter() {
  if (_resolved) return _limiter
  _resolved = true
  if (!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)) {
    return null // dev sin KV → sin límite
  }
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ])
  _limiter = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(60, "60 s"), // 60 req/min por token
    prefix: "mcp:rl",
  })
  return _limiter
}

/** @returns {Promise<boolean>} true si está permitido, false si excede. */
export async function allow(identifier) {
  const l = await limiter()
  if (!l) return true
  const { success } = await l.limit(identifier)
  return success
}
