// Overview multi-atleta: agregación server-side y compacta para comparar
// varios atletas de un vistazo sin quemar tokens con N llamadas + series
// crudas. Reusa getWellness/getActivities/listAthletes, una fila escalar
// por atleta.
import { getWellness } from "./wellness.js"
import { getActivities } from "./activities.js"
import { listAthletes } from "./athlete.js"

const SUBJECTIVE_FIELDS = ["soreness", "fatigue", "stress", "mood", "motivation", "injury", "sleepQuality"]

function round1(n) {
  return Math.round(n * 10) / 10
}

async function buildRow(athlete, apiKey) {
  const [wellnessList, activities] = await Promise.all([
    getWellness(athlete.id, apiKey, { days: 2 }),
    getActivities(athlete.id, apiKey, { days: 7, limit: 100 }),
  ])

  const w = Array.isArray(wellnessList) && wellnessList.length
    ? wellnessList[wellnessList.length - 1]
    : null
  const acts = Array.isArray(activities) ? activities : []

  const row = { id: athlete.id, name: athlete.name }

  if (w) {
    if (w.ctl != null) row.ctl = round1(w.ctl)
    if (w.atl != null) row.atl = round1(w.atl)
    if (w.ctl != null && w.atl != null) row.form = round1(w.ctl - w.atl)
    if (w.rampRate != null) row.rampRate = round1(w.rampRate)

    const flags = {}
    for (const key of SUBJECTIVE_FIELDS) {
      if (w[key] != null) flags[key] = w[key]
    }
    if (Object.keys(flags).length) row.flags = flags
  }

  row.weeklyTss = Math.round(acts.reduce((s, a) => s + (a.icu_training_load || 0), 0))

  const lastDates = acts.map((a) => a.start_date_local || a.start_date).filter(Boolean)
  if (lastDates.length) row.lastActivity = lastDates.sort().at(-1).slice(0, 10)

  return row
}

// athleteIds: lista opcional de "iNNN"; si viene vacía/omitida usa todos los
// atletas visibles con la key (coach mode, mismo alcance que list_athletes).
export async function getSquadOverview(apiKey, athleteIds) {
  const all = await listAthletes(apiKey)
  const targets = athleteIds && athleteIds.length
    ? all.filter((a) => athleteIds.includes(a.id))
    : all

  return Promise.all(
    targets.map(async (athlete) => {
      try {
        return await buildRow(athlete, apiKey)
      } catch (e) {
        return { id: athlete.id, name: athlete.name, error: e.message }
      }
    })
  )
}
