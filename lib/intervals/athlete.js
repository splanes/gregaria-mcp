// Perfil, curva de potencia, fitness summary, settings por deporte y listado
// de atletas accesibles (coach mode).
import { subDays, format } from "date-fns"
import { get } from "./client.js"

function dateRange(days) {
  const newest = format(new Date(), "yyyy-MM-dd")
  const oldest = format(subDays(new Date(), days), "yyyy-MM-dd")
  return { oldest, newest }
}

// Perfil: FTP, zonas, LTHR, peso, etc.
export function getAthleteInfo(athleteId, apiKey) {
  return get(`/athlete/${athleteId}`, apiKey)
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

// Settings de un deporte puntual (colores, umbrales de carga, show/hide).
export function getAthleteSportSettings(athleteId, apiKey, sport) {
  return get(`/athlete/${athleteId}/sport-settings/${sport}`, apiKey)
}

// Atletas que la API key puede ver (los que sigue/coachea, + el dueño de la key).
// No acepta athlete_id en el path: la lista siempre es relativa a la key usada.
export async function listAthletes(apiKey) {
  const r = await get("/athletes", apiKey)
  return Array.isArray(r) ? r : []
}
