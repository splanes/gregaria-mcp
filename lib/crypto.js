// AES-256-GCM para las API keys de Intervals.
// Copiado del patrón probado de gregaria-ai (lib/shared/infrastructure/encrypt.js).
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey() {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) throw new Error("ENCRYPTION_KEY not set (openssl rand -hex 32)")
  const buf = Buffer.from(hex, "hex")
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY debe ser 32 bytes en hex (64 chars)")
  return buf
}

export function encrypt(text) {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")
  return JSON.stringify({ encryptedData: encrypted, iv: iv.toString("hex"), authTag })
}

export function decrypt(stored) {
  const key = getKey()
  const { encryptedData, iv, authTag } = JSON.parse(stored)
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"))
  decipher.setAuthTag(Buffer.from(authTag, "hex"))
  let decrypted = decipher.update(encryptedData, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

// Token opaco para el connector. Guardamos SOLO el sha256; el crudo se muestra una vez.
export function generateToken() {
  return "tok_" + randomBytes(24).toString("base64url")
}

export function hashToken(raw) {
  return createHash("sha256").update(raw).digest("hex")
}
