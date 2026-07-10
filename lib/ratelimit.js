// Rate-limit por token. Si no hay Upstash configurado (dev), es no-op.
let _limiter = null
let _resolved = false

// Acepta el naming de Upstash directo o el que inyecta la integración Vercel KV.
const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

async function limiter() {
  if (_resolved) return _limiter
  _resolved = true
  if (!(redisUrl() && redisToken())) {
    return null // dev sin KV → sin límite
  }
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ])
  _limiter = new Ratelimit({
    redis: new Redis({ url: redisUrl(), token: redisToken() }),
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
