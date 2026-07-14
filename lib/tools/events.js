import { addDays, format } from "date-fns"
import { z } from "zod"
import {
  getEvents,
  getEventById,
  addOrUpdateEvent,
  deleteEvent,
  deleteEventsByDateRange,
} from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"

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
    "Creates (or updates if event_id is passed) a calendar event: planned workout, note, etc.",
    {
      ...athleteIdArg,
      name: z.string(),
      workout_type: z.string().describe("e.g. 'Ride', 'Run', 'Swim', 'Walk', 'Row'"),
      event_id: z.string().optional().describe("If passed, updates the existing event instead of creating a new one"),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, default today"),
      description: z.string().optional().describe("Free-form description of the event"),
      workout_doc: z.record(z.string(), z.any()).optional()
        .describe("Free-form object with the workout structure (steps, etc.); serialized as-is with JSON.stringify as description, overriding 'description' if both are given"),
      moving_time: z.number().int().positive().optional().describe("Expected duration in seconds"),
      distance: z.number().int().positive().optional().describe("Expected distance in meters"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => {
        const startDate = args.start_date || dateStr()
        const description = args.workout_doc ? JSON.stringify(args.workout_doc) : args.description
        const eventData = {
          start_date_local: `${startDate}T00:00:00`,
          category: "WORKOUT",
          name: args.name,
          description: description ?? null,
          type: args.workout_type,
          moving_time: args.moving_time,
          distance: args.distance,
        }
        return addOrUpdateEvent(resolveAthleteId(args), apiKey, eventData, args.event_id)
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
