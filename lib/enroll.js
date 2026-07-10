// Núcleo compartido de alta/baja. Lo usan LAS DOS vías: la CLI y la web.
import { encrypt, generateToken, hashToken } from "./crypto.js"
import { putRow, delRow, getByToken } from "./store.js"

/**
 * Da de alta un atleta. Cifra la API key, genera un token opaco,
 * guarda SOLO el hash del token, y devuelve el token crudo UNA vez.
 * @returns {Promise<{ token: string }>}
 */
export async function enroll({ name, athleteId, apiKey }) {
  if (!athleteId || !/^i\d+$/.test(String(athleteId).trim())) {
    throw new Error("athleteId inválido: debe ser tipo iXXXXX (ej. i218573)")
  }
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error("apiKey inválida o vacía")
  }

  const token = generateToken()
  await putRow(hashToken(token), {
    athlete_id: String(athleteId).trim(),
    name: (name || "").trim() || null,
    enc_key: encrypt(apiKey.trim()),
    created_at: new Date().toISOString(),
  })
  return { token }
}

/** Revoca por token crudo. */
export async function revoke(rawToken) {
  const row = await getByToken(rawToken)
  if (!row) return false
  await delRow(hashToken(rawToken))
  return true
}
