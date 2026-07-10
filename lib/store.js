// KV store: token_hash → { athlete_id, name, enc_key, created_at }.
// Backend real: Upstash Redis (o Vercel KV, mismas env vars).
// Fallback local (SOLO dev/CLI, si no hay Upstash): archivo .data/store.json.
import { hashToken } from "./crypto.js"

const KEY_PREFIX = "mcp:tok:"
const SET_KEY = "mcp:tokens"

// Acepta el naming de Upstash directo o el que inyecta la integración Vercel KV.
const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

function useUpstash() {
  return Boolean(redisUrl() && redisToken())
}

// ── Upstash backend ──────────────────────────────────────────────────────────
let _redis = null
async function redis() {
  if (!_redis) {
    const { Redis } = await import("@upstash/redis")
    _redis = new Redis({ url: redisUrl(), token: redisToken() })
  }
  return _redis
}

// ── File backend (dev) ───────────────────────────────────────────────────────
async function fileIO() {
  const { readFile, writeFile, mkdir } = await import("fs/promises")
  const path = ".data/store.json"
  const read = async () => {
    try {
      return JSON.parse(await readFile(path, "utf8"))
    } catch {
      return {}
    }
  }
  const write = async (obj) => {
    await mkdir(".data", { recursive: true })
    await writeFile(path, JSON.stringify(obj, null, 2))
  }
  return { read, write }
}

// ── API unificada ────────────────────────────────────────────────────────────
export async function putRow(tokenHash, row) {
  if (useUpstash()) {
    const r = await redis()
    await r.set(KEY_PREFIX + tokenHash, row)
    await r.sadd(SET_KEY, tokenHash)
    return
  }
  const { read, write } = await fileIO()
  const db = await read()
  db[tokenHash] = row
  await write(db)
}

export async function getRow(tokenHash) {
  if (useUpstash()) {
    const r = await redis()
    return (await r.get(KEY_PREFIX + tokenHash)) || null
  }
  const { read } = await fileIO()
  const db = await read()
  return db[tokenHash] || null
}

export async function delRow(tokenHash) {
  if (useUpstash()) {
    const r = await redis()
    await r.del(KEY_PREFIX + tokenHash)
    await r.srem(SET_KEY, tokenHash)
    return
  }
  const { read, write } = await fileIO()
  const db = await read()
  delete db[tokenHash]
  await write(db)
}

export async function listRows() {
  if (useUpstash()) {
    const r = await redis()
    const hashes = (await r.smembers(SET_KEY)) || []
    const rows = []
    for (const h of hashes) {
      const row = await r.get(KEY_PREFIX + h)
      if (row) rows.push({ tokenHash: h, ...row })
    }
    return rows
  }
  const { read } = await fileIO()
  const db = await read()
  return Object.entries(db).map(([tokenHash, row]) => ({ tokenHash, ...row }))
}

// Resuelve un token crudo (Bearer) → fila. No expone el hashing al caller.
export async function getByToken(rawToken) {
  if (!rawToken) return null
  return getRow(hashToken(rawToken))
}
