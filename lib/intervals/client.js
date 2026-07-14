// Base HTTP client for Intervals.icu. Bearer auth: the "apiKey" each function
// receives is actually the Intervals.icu OAuth access token forwarded by Claude
// (stateless relay, see app/api/[transport]/route.js). 10s timeout and HTTP
// errors mapped to clear messages.
const BASE = "https://intervals.icu/api/v1"
const TIMEOUT_MS = 10_000

function authHeader(apiKey) {
  return "Bearer " + apiKey
}

const ERROR_MESSAGES = {
  401: "401 Unauthorized: Intervals rejected the API key. Check/regenerate your key.",
  403: "403 Forbidden: you don't have permission to access this resource.",
  404: "404 Not Found: the endpoint or ID doesn't exist.",
  422: "422 Unprocessable Entity: invalid parameters or the operation isn't supported.",
  429: "429 Too Many Requests: too many requests in a short time.",
  500: "500 Internal Server Error: Intervals.icu had an internal error.",
  503: "503 Service Unavailable: Intervals.icu might be down or under maintenance.",
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
