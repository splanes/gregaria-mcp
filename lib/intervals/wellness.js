import { subDays, format } from "date-fns"
import { get, put } from "./client.js"

function dateRange(days) {
  const newest = format(new Date(), "yyyy-MM-dd")
  const oldest = format(subDays(new Date(), days), "yyyy-MM-dd")
  return { oldest, newest }
}

// Wellness: HRV, RHR, sleep, subjective feel.
export function getWellness(athleteId, apiKey, { start, end, days = 14 } = {}) {
  const r = start && end ? { oldest: start, newest: end } : dateRange(days)
  return get(`/athlete/${athleteId}/wellness`, apiKey, { params: r })
}

// PUT /athlete/{id}/wellness/{date}: the API only updates the fields sent in
// the body ("Only fields provided are changed") — it's a merge, not a full-day
// replacement. `fields` must already come without undefined keys (see
// lib/tools/wellness.js).
export function updateWellness(athleteId, apiKey, date, fields) {
  return put(`/athlete/${athleteId}/wellness/${date}`, apiKey, fields)
}
