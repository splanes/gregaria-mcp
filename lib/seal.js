// Encrypted, ephemeral envelopes for carrying OAuth flow state (proxy mode) WITHOUT
// persisting anything server-side. The state travels encrypted inside the
// `state`/`code` params that bounce through the browser (Intervals) or that Claude
// hands back to us when exchanging the code — never written to disk/KV. AES-256-GCM
// with expiration embedded in the payload (unseal fails once it's past due).
//
// Different from the old `lib/crypto.js` encryption that used to exist: here we
// don't hold anything permanently, we just avoid storing state for an in-flight
// request (TTL of minutes, lives and dies with the redirect).
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey() {
  const hex = process.env.RELAY_SEAL_KEY
  if (!hex) throw new Error("RELAY_SEAL_KEY not set (openssl rand -hex 32)")
  const buf = Buffer.from(hex, "hex")
  if (buf.length !== 32) throw new Error("RELAY_SEAL_KEY must be 32 bytes in hex (64 chars)")
  return buf
}

// payload: JSON-serializable object. ttlSeconds: expiration embedded in it (no storage dependency).
export function seal(payload, ttlSeconds) {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const body = JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })
  const encrypted = Buffer.concat([cipher.update(body, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url")
}

export function unseal(sealed) {
  const key = getKey()
  const raw = Buffer.from(sealed, "base64url")
  const iv = raw.subarray(0, 12)
  const authTag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
  const payload = JSON.parse(decrypted)
  if (!payload.exp || Date.now() > payload.exp) throw new Error("sealed payload expired")
  return payload
}
