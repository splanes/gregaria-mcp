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
    "Eventos del calendario (workouts planeados, notas, etc.) en un rango de fechas (default: hoy a +30 días).",
    {
      ...athleteIdArg,
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, default hoy"),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, default +30 días"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getEvents(resolveAthleteId(args), apiKey, defaultEventRange(args)))
    }
  )

  server.tool(
    "get_event_by_id",
    "Detalle de un evento puntual del calendario.",
    { ...athleteIdArg, event_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getEventById(resolveAthleteId(args), args.event_id, apiKey))
    }
  )

  server.tool(
    "add_or_update_event",
    "Crea (o actualiza si se pasa event_id) un evento en el calendario: workout planeado, nota, etc.",
    {
      ...athleteIdArg,
      name: z.string(),
      workout_type: z.string().describe("ej. 'Ride', 'Run', 'Swim', 'Walk', 'Row'"),
      event_id: z.string().optional().describe("Si se pasa, actualiza el evento existente en vez de crear uno nuevo"),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, default hoy"),
      description: z.string().optional().describe("Descripción libre del evento"),
      workout_doc: z.record(z.string(), z.any()).optional()
        .describe("Objeto libre con la estructura del workout (pasos, etc.); se serializa tal cual con JSON.stringify como description, pisando 'description' si ambos vienen"),
      moving_time: z.number().int().positive().optional().describe("Duración esperada en segundos"),
      distance: z.number().int().positive().optional().describe("Distancia esperada en metros"),
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
    "Borra PERMANENTEMENTE un evento del calendario. Usar solo si el usuario confirmó explícitamente que quiere eliminar ese evento.",
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
    "Borra PERMANENTEMENTE todos los eventos del calendario en un rango de fechas. Usar solo si el usuario confirmó explícitamente el rango a borrar — no hay vuelta atrás.",
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
