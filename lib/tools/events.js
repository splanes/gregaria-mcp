import { addDays, format } from "date-fns"
import { z } from "zod"
import {
  getEvents,
  getEventById,
  addOrUpdateEvent,
  deleteEvent,
  deleteEventsByDateRange,
} from "../intervals/index.js"
import { ctx, ok, run, resolveAthleteId, athleteIdArg } from "./shared.js"
import { parseWorkoutText, verifyWorkoutDoc } from "../workout-text.js"

const dateStr = () => format(new Date(), "yyyy-MM-dd")

function defaultEventRange({ start, end }) {
  return {
    start: start || dateStr(),
    end: end || format(addDays(new Date(), 30), "yyyy-MM-dd"),
  }
}

export function registerEventTools(server) {
  server.tool(
    "get_events",
    "Calendar events (planned workouts, notes, etc.) in a date range (default: today to +30 days).",
    {
      ...athleteIdArg,
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, default today"),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, default +30 days"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getEvents(resolveAthleteId(args), apiKey, defaultEventRange(args)))
    }
  )

  server.tool(
    "get_event_by_id",
    "Detail of a single calendar event.",
    { ...athleteIdArg, event_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getEventById(resolveAthleteId(args), args.event_id, apiKey))
    }
  )

  server.tool(
    "add_or_update_event",
    "Creates (or updates if event_id is passed) a calendar event: planned workout, note, etc. " +
      "Prefer 'workout_doc' over free-text 'description' for structured workouts: Intervals parses " +
      "'description' into steps server-side, and that parser is silently lossy (missing blank lines " +
      "between blocks drop power targets, prose with duration-like tokens becomes phantom steps, " +
      "repetition headers written with a leading '-' collapse to 1 rep). When 'description' is used, " +
      "the response includes 'warnings' (pre-flight, local) and 'verification' (post-flight, diffed " +
      "against what Intervals actually stored) — check both before trusting the write.",
    {
      ...athleteIdArg,
      name: z.string(),
      workout_type: z.string().describe("e.g. 'Ride', 'Run', 'Swim', 'Walk', 'Row'"),
      event_id: z.string().optional().describe("If passed, updates the existing event instead of creating a new one"),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, default today"),
      description: z.string().optional()
        .describe("Free-form text description. If it encodes workout steps, prefer 'workout_doc' instead — this field goes through Intervals' text parser, which is silently lossy (see tool description)."),
      workout_doc: z.record(z.string(), z.any()).optional()
        .describe("Structured workout object (steps, etc.), sent as-is to Intervals' 'workout_doc' field. Preferred over 'description' for workouts: it bypasses the lossy text parser entirely."),
      moving_time: z.number().int().positive().optional().describe("Expected duration in seconds"),
      distance: z.number().int().positive().optional().describe("Expected distance in meters"),
      strict: z.boolean().optional().default(false)
        .describe("If true, abort without writing when the local pre-flight check of 'description' finds warnings. Ignored when 'workout_doc' is given directly."),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)

      // Only the text-description path is parsed server-side, so only it needs guarding.
      const parsed = args.workout_doc === undefined ? parseWorkoutText(args.description) : null

      if (parsed && args.strict && parsed.warnings.length > 0) {
        return ok({
          aborted: true,
          warnings: parsed.warnings,
          message: `Aborted without writing: ${parsed.warnings.length} warning(s) found in 'description' and strict=true. Fix the text, switch to 'workout_doc', or resend with strict=false to write anyway.`,
        })
      }

      return run(async () => {
        const startDate = args.start_date || dateStr()
        const eventData = {
          start_date_local: `${startDate}T00:00:00`,
          category: "WORKOUT",
          name: args.name,
          description: args.description ?? null,
          type: args.workout_type,
          moving_time: args.moving_time,
          distance: args.distance,
        }
        if (args.workout_doc !== undefined) eventData.workout_doc = args.workout_doc

        const event = await addOrUpdateEvent(resolveAthleteId(args), apiKey, eventData, args.event_id)

        const verification = parsed
          ? verifyWorkoutDoc(parsed, event?.workout_doc)
          : { status: "ok", issues: [], message: "workout_doc sent directly; Intervals' text parser wasn't used, so there's nothing to verify." }

        return { event, warnings: parsed?.warnings ?? [], verification }
      })
    }
  )

  server.tool(
    "delete_event",
    "PERMANENTLY deletes a calendar event. Only use if the user explicitly confirmed they want to delete that event.",
    { ...athleteIdArg, event_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(async () => {
        await deleteEvent(resolveAthleteId(args), args.event_id, apiKey)
        return { deleted: args.event_id }
      })
    }
  )

  server.tool(
    "delete_events_by_date_range",
    "PERMANENTLY deletes all calendar events in a date range. Only use if the user explicitly confirmed the range to delete — there's no undo.",
    {
      ...athleteIdArg,
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() =>
        deleteEventsByDateRange(resolveAthleteId(args), apiKey, {
          start: args.start_date,
          end: args.end_date,
        })
      )
    }
  )
}
