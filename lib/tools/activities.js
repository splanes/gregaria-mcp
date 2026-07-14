import { z } from "zod"
import {
  getActivities,
  getActivityDetails,
  getActivityIntervals,
  getActivityStreams,
  getActivityMessages,
  postActivityMessage,
  updateActivity,
  deleteActivity,
  updateActivityInterval,
} from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"

const dateArgs = {
  ...athleteIdArg,
  days: z.number().int().positive().max(365).optional()
    .describe("Lookback window in days (default 14)"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  limit: z.number().int().positive().max(500).optional().describe("Max activities to return"),
}

export function registerActivityTools(server) {
  server.tool(
    "get_activities",
    "Recent activities: power, HR, TSS, duration, zones.",
    dateArgs,
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivities(resolveAthleteId(args), apiKey, args))
    }
  )

  server.tool(
    "get_activity_details",
    "Full detail of a single activity (power, HR, distance, zones, etc.).",
    { activity_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivityDetails(args.activity_id, apiKey))
    }
  )

  server.tool(
    "get_activity_intervals",
    "Detected intervals of an activity (power, HR, cadence, etc. per interval, including groups).",
    { activity_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivityIntervals(args.activity_id, apiKey))
    }
  )

  server.tool(
    "get_activity_streams",
    "Time series for an activity (power, HR, cadence, altitude, distance, speed). Long arrays come truncated to a preview (first/last 5 points).",
    {
      activity_id: z.string(),
      types: z.string().optional()
        .describe("Comma-separated types, e.g. 'time,watts,heartrate'. Default: time,watts,heartrate,cadence,altitude,distance,velocity_smooth"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivityStreams(args.activity_id, apiKey, args))
    }
  )

  server.tool(
    "get_activity_messages",
    "Chat messages/comments on an activity.",
    {
      activity_id: z.string(),
      since_id: z.string().optional().describe("Only fetch messages after this ID"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivityMessages(args.activity_id, apiKey, { sinceId: args.since_id }))
    }
  )

  server.tool(
    "post_activity_message",
    "Posts a message/comment on an activity (coaching feedback).",
    { activity_id: z.string(), text: z.string().min(1) },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => postActivityMessage(args.activity_id, apiKey, args.text.trim()))
    }
  )

  server.tool(
    "update_activity",
    "Updates an activity's metadata (name, description, type). Only the fields provided are sent.",
    {
      activity_id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      activity_type: z.string().optional().describe("e.g. 'Ride', 'Run', 'Swim'"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => {
        const fields = {}
        if (args.name !== undefined) fields.name = args.name
        if (args.description !== undefined) fields.description = args.description
        if (args.activity_type !== undefined) fields.type = args.activity_type
        if (Object.keys(fields).length === 0) {
          throw new Error("At least one field (name, description, or activity_type) must be present.")
        }
        return updateActivity(args.activity_id, apiKey, fields)
      })
    }
  )

  server.tool(
    "delete_activity",
    "PERMANENTLY deletes an activity from Intervals.icu. Only use if the user explicitly confirmed they want to delete that activity.",
    { activity_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(async () => {
        await deleteActivity(args.activity_id, apiKey)
        return { deleted: args.activity_id }
      })
    }
  )

  server.tool(
    "update_activity_interval",
    "Fixes or creates an interval on an activity (indices within the streams). To create a new one, use a negative interval_id (e.g. -1).",
    {
      activity_id: z.string(),
      interval_id: z.string(),
      start_index: z.number().int().nonnegative(),
      end_index: z.number().int().nonnegative(),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => {
        if (args.start_index >= args.end_index) {
          throw new Error("start_index must be less than end_index.")
        }
        return updateActivityInterval(args.activity_id, args.interval_id, apiKey, {
          startIndex: args.start_index,
          endIndex: args.end_index,
        })
      })
    }
  )
}
