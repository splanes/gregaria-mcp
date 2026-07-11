// Tools de análisis agregado: fan-out a varias llamadas del cliente +
// agregación en JS (conteos, sumas, promedios, buckets de carga semanal,
// recomendaciones basadas en reglas), devolviendo JSON en vez de Markdown.
import { subDays, format } from "date-fns"
import { z } from "zod"
import {
  getActivityDetails,
  getActivityIntervals,
  getActivityStreams,
  getActivityMessages,
  getActivities,
  getWellness,
  getPowerCurve,
  getEvents,
  getSquadOverview,
} from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"

function dateRangeDaysAgo(days) {
  const end = new Date()
  const start = subDays(end, days)
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") }
}

function asList(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") return Object.values(value).filter((v) => v && typeof v === "object")
  return []
}

function avg(list, key) {
  if (!list.length) return 0
  return list.reduce((s, w) => s + (w[key] || 0), 0) / list.length
}

// Horas de sueño promedio. La API expone sleepSecs (segundos), no "sleep".
function computeAvgSleepHours(list) {
  if (!list.length) return 0
  return list.reduce((s, w) => s + (w.sleepSecs || 0), 0) / list.length / 3600
}

async function buildActivityAnalysis(activityId, apiKey) {
  const activity = await getActivityDetails(activityId, apiKey)
  if (!activity) throw new Error(`Actividad ${activityId} no encontrada.`)

  const [intervalsData, streams, messages] = await Promise.all([
    getActivityIntervals(activityId, apiKey).catch(() => null),
    getActivityStreams(activityId, apiKey, {}).catch(() => null),
    getActivityMessages(activityId, apiKey).catch(() => null),
  ])

  const icuIntervals = intervalsData?.icu_intervals || []
  const icuGroups = intervalsData?.icu_groups || []
  const messageList = Array.isArray(messages) ? messages : []

  return {
    activity,
    intervals: {
      count: icuIntervals.length,
      groups: icuGroups.map((g) => ({ name: g.name, count: (g.intervals || []).length })),
      items: icuIntervals.slice(0, 10),
      moreCount: Math.max(0, icuIntervals.length - 10),
    },
    streams: Array.isArray(streams)
      ? streams.map((s) => ({ type: s.type, dataPointCount: s.dataPointCount ?? (s.data?.length || 0) }))
      : null,
    messages: messageList.slice(-5),
    messageCount: messageList.length,
  }
}

async function buildProgressAnalysis(athleteId, apiKey, days) {
  const range = dateRangeDaysAgo(days)

  const [activitiesResult, wellnessResult, powerCurve] = await Promise.all([
    getActivities(athleteId, apiKey, { start: range.start, end: range.end, limit: 100 }),
    getWellness(athleteId, apiKey, { start: range.start, end: range.end }),
    getPowerCurve(athleteId, apiKey).catch(() => null),
  ])

  const activities = asList(activitiesResult)
  const byType = {}
  let totalDistance = 0
  let totalTime = 0
  let totalLoad = 0
  for (const a of activities) {
    const t = a.type || "Unknown"
    byType[t] = (byType[t] || 0) + 1
    totalDistance += a.distance || 0
    totalTime += a.moving_time || 0
    totalLoad += a.icu_training_load || 0
  }

  const wellnessList = asList(wellnessResult)

  return {
    athleteId,
    days,
    activities: {
      total: activities.length,
      byType,
      totalDistanceKm: totalDistance / 1000,
      totalTimeHours: totalTime / 3600,
      totalLoad,
      avgLoadPerActivity: activities.length ? totalLoad / activities.length : 0,
    },
    wellness: {
      avgSleepHours: computeAvgSleepHours(wellnessList),
      avgStress: avg(wellnessList, "stress"),
      avgFatigue: avg(wellnessList, "fatigue"),
      sampleCount: wellnessList.length,
    },
    powerCurve,
  }
}

function loadAssessment(weeklyLoad) {
  if (weeklyLoad < 300) return "low"
  if (weeklyLoad < 600) return "moderate"
  if (weeklyLoad < 900) return "high"
  return "very_high"
}

function trainingLoadRecommendations({ weeklyLoad, plannedWorkouts, completedActivities, avgFatigue, avgSleepHours }) {
  const recommendations = []
  if (weeklyLoad > 900) recommendations.push("Considerar una semana de recuperación con volumen reducido.")
  else if (weeklyLoad < 300) recommendations.push("Aumentar gradualmente la carga de entrenamiento.")

  if (plannedWorkouts > 0 && completedActivities < plannedWorkouts * 0.7) {
    recommendations.push("Revisar el plan de entrenamiento — la adherencia es baja, considerar reducir lo planeado.")
  } else if (plannedWorkouts > 0 && completedActivities > plannedWorkouts) {
    recommendations.push("Buena adherencia al plan — asegurar recuperación adecuada.")
  }

  if (avgFatigue > 7) recommendations.push("Fatiga alta detectada — priorizar sueño y recuperación activa.")
  else if (avgSleepHours > 0 && avgSleepHours < 7) recommendations.push("Sueño insuficiente — priorizar recuperación.")

  if (!recommendations.length) {
    recommendations.push("La carga de entrenamiento parece equilibrada — continuar con el enfoque actual.")
  }
  return recommendations
}

async function buildTrainingLoadAnalysis(athleteId, apiKey, days) {
  const range = dateRangeDaysAgo(days)

  const [eventsResult, activitiesResult, wellnessResult] = await Promise.all([
    getEvents(athleteId, apiKey, { start: range.start, end: range.end }),
    getActivities(athleteId, apiKey, { start: range.start, end: range.end, limit: 100 }),
    getWellness(athleteId, apiKey, { start: range.start, end: range.end }),
  ])

  const events = asList(eventsResult)
  const activities = asList(activitiesResult)
  const wellnessList = asList(wellnessResult)

  const totalLoad = activities.reduce((s, a) => s + (a.icu_training_load || 0), 0)
  const weeklyLoad = days > 0 ? totalLoad / (days / 7) : 0

  const plannedWorkouts = events.filter((e) => e.category === "WORKOUT").length
  const completedActivities = activities.length
  const completionRate = plannedWorkouts > 0 ? (completedActivities / plannedWorkouts) * 100 : null

  const recentWellness = wellnessList.slice(-7)
  const avgFatigue = avg(recentWellness, "fatigue")
  const avgSleepHours = computeAvgSleepHours(recentWellness)

  return {
    athleteId,
    days,
    totalLoad,
    weeklyLoad,
    loadAssessment: loadAssessment(weeklyLoad),
    plannedWorkouts,
    completedActivities,
    completionRate,
    recovery: { avgFatigue, avgSleepHours, sampleCount: recentWellness.length },
    recommendations: trainingLoadRecommendations({
      weeklyLoad,
      plannedWorkouts,
      completedActivities,
      avgFatigue,
      avgSleepHours,
    }),
  }
}

export function registerAnalysisTools(server) {
  server.tool(
    "analyze_activity",
    "Análisis comprehensivo de una actividad puntual: detalle + intervals + resumen de streams + últimos mensajes.",
    { activity_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => buildActivityAnalysis(args.activity_id, apiKey))
    }
  )

  server.tool(
    "analyze_progress",
    "Progreso del atleta en un período: actividades por tipo, distancia/tiempo/carga totales, promedios de wellness, curva de potencia.",
    { ...athleteIdArg, days: z.number().int().positive().max(365).optional().describe("default 30") },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => buildProgressAnalysis(resolveAthleteId(args), apiKey, args.days ?? 30))
    }
  )

  server.tool(
    "analyze_training_load",
    "Carga de entrenamiento y recomendaciones: carga total/semanal, plan vs ejecución, estado de recuperación.",
    { ...athleteIdArg, days: z.number().int().positive().max(365).optional().describe("default 42") },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => buildTrainingLoadAnalysis(resolveAthleteId(args), apiKey, args.days ?? 42))
    }
  )

  server.tool(
    "get_squad_overview",
    "Compara varios atletas de un vistazo (coach mode): una fila compacta por atleta con CTL, ATL, forma " +
      "(CTL-ATL), ramp rate, TSS de los últimos 7 días, fecha de última actividad, y flags de wellness " +
      "subjetivo reciente (soreness, fatigue, etc). Pensada para no quemar tokens: agrega en el servidor " +
      "en vez de que el LLM haga N llamadas por atleta. Si un atleta falla (sin permiso, etc.), aparece con 'error' " +
      "y no rompe el resto.",
    {
      athlete_ids: z.array(z.string().regex(/^i\d+$/)).optional()
        .describe("Lista de athlete_id (ej. ['i111','i222']); si se omite, usa todos los atletas visibles con la key (igual que list_athletes)"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getSquadOverview(apiKey, args.athlete_ids))
    }
  )
}
