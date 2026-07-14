import { format } from "date-fns"
import { z } from "zod"
import { getWellness, updateWellness } from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"

const dateArgs = {
  ...athleteIdArg,
  days: z.number().int().positive().max(365).optional()
    .describe("Lookback window in days (default 14)"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
}

// 1-4 scale used by Intervals.icu for all subjective fields:
// 1 = good, 4 = bad (same direction for all 7 fields, confirmed at
// forum.intervals.icu/t/wellness-data-ordering-of-mood-stress-soreness-scores/19416).
const scale1to4 = (label) =>
  z.number().int().min(1).max(4).optional().describe(`${label}, 1-4 scale (1 = good, 4 = bad)`)

const updateArgs = {
  ...athleteIdArg,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("YYYY-MM-DD, default today"),
  soreness: scale1to4("Muscle soreness"),
  fatigue: scale1to4("Fatigue"),
  stress: scale1to4("Stress"),
  mood: scale1to4("Mood"),
  motivation: scale1to4("Motivation"),
  injury: scale1to4("Injury/discomfort"),
  sleepQuality: scale1to4("Sleep quality"),
  weight: z.number().positive().optional().describe("Weight in kg"),
  notes: z.string().optional().describe("Free-form notes for the day"),
}

export function registerWellnessTools(server) {
  server.tool(
    "get_wellness",
    "Recovery metrics: HRV, RHR, sleep, subjective feel (for 'how was my HRV today?').",
    dateArgs,
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getWellness(resolveAthleteId(args), apiKey, args))
    }
  )

  server.tool(
    "update_wellness",
    "Logs manual wellness for a day: subjective fields (soreness, fatigue, stress, mood, motivation, injury, " +
      "sleepQuality on a 1-4 scale, 1=good/4=bad), weight, and notes. Only updates the fields sent " +
      "(merge, doesn't erase what's already set). Useful for what the watch doesn't capture (soreness, mood, etc.).",
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
          throw new Error("At least one field must be present (soreness, fatigue, stress, mood, motivation, injury, sleepQuality, weight, or notes).")
        }
        return updateWellness(resolveAthleteId(args), apiKey, date, fields)
      })
    }
  )
}
