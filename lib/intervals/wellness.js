import { subDays, format } from "date-fns"
import { get, put } from "./client.js"

function dateRange(days) {
  const newest = format(new Date(), "yyyy-MM-dd")
  const oldest = format(subDays(new Date(), days), "yyyy-MM-dd")
  return { oldest, newest }
}

// Wellness: HRV, RHR, sueño, feel subjetivo.
export function getWellness(athleteId, apiKey, { start, end, days = 14 } = {}) {
  const r = start && end ? { oldest: start, newest: end } : dateRange(days)
  return get(`/athlete/${athleteId}/wellness`, apiKey, { params: r })
}

// PUT /athlete/{id}/wellness/{date}: la API solo actualiza los campos
// enviados en el body ("Only fields provided are changed") — es un merge,
// no un reemplazo del día completo. `fields` debe venir ya sin claves
// undefined (ver lib/tools/wellness.js).
export function updateWellness(athleteId, apiKey, date, fields) {
  return put(`/athlete/${athleteId}/wellness/${date}`, apiKey, fields)
}
