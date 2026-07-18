import { addDays, format } from "date-fns"
import { z } from "zod"
import {
  getEvents,
  getEventById,
  deleteEvent,
  deleteEventsByDateRange,
} from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"
import { handleAddOrUpdateEvent } from "./add-or-update-event.js"

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
      "'description' into steps server-side, and that parser is confirmed silently lossy in some " +
      "cases (a step keeps its duration but loses its power target; repetition headers written with " +
      "a leading '-' collapse to 1 rep) — root cause not fully pinned down, so it can't be avoided by " +
      "text formatting alone. Returns {event, warnings, verification} — NOT the bare event object. " +
      "'warnings' are local pre-flight heuristics on 'description' (best-effort, not a reliable " +
      "predictor either way); 'verification' diffs the response against what was requested and is the " +
      "authoritative signal — check verification.status before trusting the write.",
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
      return run(() => handleAddOrUpdateEvent(args, apiKey))
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
