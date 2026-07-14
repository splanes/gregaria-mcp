// Profile, power curve, fitness summary and per-sport settings.
import { subDays, format } from "date-fns"
import { get, put } from "./client.js"

function dateRange(days) {
  const newest = format(new Date(), "yyyy-MM-dd")
  const oldest = format(subDays(new Date(), days), "yyyy-MM-dd")
  return { oldest, newest }
}

// Profile: FTP, zones, LTHR, weight, etc.
export function getAthleteInfo(athleteId, apiKey) {
  return get(`/athlete/${athleteId}`, apiKey)
}

// Power curve.
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

// Settings for a specific sport (colors, load thresholds, show/hide flags).
export function getAthleteSportSettings(athleteId, apiKey, sport) {
  return get(`/athlete/${athleteId}/sport-settings/${sport}`, apiKey)
}

// PUT /athlete/{id}/sport-settings/{sportSettingsId}: partial merge, only
// changes the fields sent (same behavior as updateWellness). sportSettingsId
// is the numeric id of the sport-settings object (not the sport name) — it's
// resolved first via getAthleteSportSettings.
export function updateSportSettings(athleteId, apiKey, sportSettingsId, fields) {
  return put(`/athlete/${athleteId}/sport-settings/${sportSettingsId}`, apiKey, fields)
}
