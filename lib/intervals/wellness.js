import { subDays, format } from "date-fns"
import { get } from "./client.js"

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
