import { format } from "date-fns"
import { z } from "zod"
import { getWellness, updateWellness } from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"

const dateArgs = {
  ...athleteIdArg,
  days: z.number().int().positive().max(365).optional()
    .describe("Ventana en días hacia atrás (default 14)"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
}

// Escala 1-4 usada por Intervals.icu para todos los campos subjetivos:
// 1 = bien, 4 = mal (misma dirección para los 7 campos, confirmado en
// forum.intervals.icu/t/wellness-data-ordering-of-mood-stress-soreness-scores/19416).
const scale1to4 = (label) =>
  z.number().int().min(1).max(4).optional().describe(`${label}, escala 1-4 (1 = bien, 4 = mal)`)

const updateArgs = {
  ...athleteIdArg,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("YYYY-MM-DD, default hoy"),
  soreness: scale1to4("Dolor muscular"),
  fatigue: scale1to4("Fatiga"),
  stress: scale1to4("Estrés"),
  mood: scale1to4("Estado de ánimo"),
  motivation: scale1to4("Motivación"),
  injury: scale1to4("Lesión/molestia"),
  sleepQuality: scale1to4("Calidad de sueño"),
  weight: z.number().positive().optional().describe("Peso en kg"),
  notes: z.string().optional().describe("Notas libres del día"),
}

export function registerWellnessTools(server) {
  server.tool(
    "get_wellness",
    "Métricas de recuperación: HRV, RHR, sueño, feel subjetivo (para '¿cómo estuvo mi HRV hoy?').",
    dateArgs,
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getWellness(resolveAthleteId(args), apiKey, args))
    }
  )

  server.tool(
    "update_wellness",
    "Registra wellness manual de un día: subjetivos (soreness, fatigue, stress, mood, motivation, injury, " +
      "sleepQuality en escala 1-4, 1=bien/4=mal), peso y notas. Solo actualiza los campos enviados " +
      "(merge, no borra lo ya cargado). Útil para lo que el reloj no capta (soreness, ánimo, etc.).",
    updateArgs,
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => {
        const date = args.date || format(new Date(), "yyyy-MM-dd")
        const fields = {}
        if (args.soreness !== undefined) fields.soreness = args.soreness
        if (args.fatigue !== undefined) fields.fatigue = args.fatigue
        if (args.stress !== undefined) fields.stress = args.stress
        if (args.mood !== undefined) fields.mood = args.mood
        if (args.motivation !== undefined) fields.motivation = args.motivation
        if (args.injury !== undefined) fields.injury = args.injury
        if (args.sleepQuality !== undefined) fields.sleepQuality = args.sleepQuality
        if (args.weight !== undefined) fields.weight = args.weight
        if (args.notes !== undefined) fields.comments = args.notes
        if (Object.keys(fields).length === 0) {
          throw new Error("Al menos un campo debe estar presente (soreness, fatigue, stress, mood, motivation, injury, sleepQuality, weight o notes).")
        }
        return updateWellness(resolveAthleteId(args), apiKey, date, fields)
      })
    }
  )
}
