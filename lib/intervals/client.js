// Cliente HTTP base de Intervals.icu. Basic auth con usuario literal "API_KEY"
// y la key como password (mismo patrón que gregaria-ai). Timeout 10s y mapeo
// de errores HTTP a mensajes claros.
const BASE = "https://intervals.icu/api/v1"
const TIMEOUT_MS = 10_000

function authHeader(apiKey) {
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64")
}

const ERROR_MESSAGES = {
  401: "401 Unauthorized: Intervals rechazó la API key. Revisá/regenerá tu key.",
  403: "403 Forbidden: no tenés permiso para acceder a este recurso.",
  404: "404 Not Found: el endpoint o ID no existe.",
  422: "422 Unprocessable Entity: parámetros inválidos o la operación no es soportada.",
  429: "429 Too Many Requests: demasiadas solicitudes en poco tiempo.",
  500: "500 Internal Server Error: Intervals.icu tuvo un error interno.",
  503: "503 Service Unavailable: Intervals.icu podría estar caído o en mantenimiento.",
}

export async function request(method, path, apiKey, { params = {}, body, ignore404 = false } = {}) {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }

  const headers = { Authorization: authHeader(apiKey) }
  const init = { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    init.body = JSON.stringify(body)
  }

  const res = await fetch(url, init)
  if (!res.ok) {
    if (ignore404 && res.status === 404) return null
    const msg = ERROR_MESSAGES[res.status] || `Intervals API error: ${res.status}`
    throw new Error(`${msg} (${method} ${path})`)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export function get(path, apiKey, opts) {
  return request("GET", path, apiKey, opts)
}

export function post(path, apiKey, body, opts) {
  return request("POST", path, apiKey, { ...opts, body })
}

export function put(path, apiKey, body, opts) {
  return request("PUT", path, apiKey, { ...opts, body })
}

export function del(path, apiKey, opts) {
  return request("DELETE", path, apiKey, opts)
}
