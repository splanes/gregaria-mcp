// Cliente read-only de Intervals.icu.
// Copiado del patrón de gregaria-ai (lib/shared/infrastructure/intervalsClient.js):
// basic auth con usuario literal "API_KEY" y la key como password.
import { subDays, format } from "date-fns"

const BASE = "https://intervals.icu/api/v1"
const TIMEOUT_MS = 10_000

function authHeader(apiKey) {
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64")
}

async function get(path, apiKey, { ignore404 = false, params = {} } = {}) {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, {
    headers: { Authorization: authHeader(apiKey) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    if (ignore404 && res.status === 404) return null
    if (res.status === 401) throw new Error("Intervals rechazó la API key (401). Revisá/regenerá tu key.")
    throw new Error(`Intervals API error: ${res.status} ${path}`)
  }
  return res.json()
}

function dateRange(days) {
  const newest = format(new Date(), "yyyy-MM-dd")
  const oldest = format(subDays(new Date(), days), "yyyy-MM-dd")
  return { oldest, newest }
}

// Perfil: FTP, zonas, LTHR, peso, etc.
export function getAthleteInfo(athleteId, apiKey) {
  return get(`/athlete/${athleteId}`, apiKey)
}

// Wellness: HRV, RHR, sueño, feel subjetivo.
export function getWellness(athleteId, apiKey, { start, end, days = 14 } = {}) {
  const r = start && end ? { oldest: start, newest: end } : dateRange(days)
  return get(`/athlete/${athleteId}/wellness`, apiKey, { params: r })
}

// Actividades recientes (carga).
export function getActivities(athleteId, apiKey, { start, end, days = 14 } = {}) {
  const r = start && end ? { oldest: start, newest: end } : dateRange(days)
  return get(`/athlete/${athleteId}/activities`, apiKey, { params: r })
}

// Curva de potencia.
export async function getPowerCurve(athleteId, apiKey, { period = "42d", type = "Ride" } = {}) {
  const r = await get(`/athlete/${athleteId}/power-curves.json`, apiKey, {
    ignore404: true,
    params: { curves: period, type },
  })
  return r || []
}

// Fitness summary: CTL / ATL / TSB (form).
export async function getFitnessSummary(athleteId, apiKey, { days = 42 } = {}) {
  const r = await get(`/athlete/${athleteId}/athlete-summary.json`, apiKey, {
    ignore404: true,
    params: dateRange(days),
  })
  return r || []
}
