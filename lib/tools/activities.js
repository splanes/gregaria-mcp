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
    .describe("Ventana en días hacia atrás (default 14)"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  limit: z.number().int().positive().max(500).optional().describe("Máximo de actividades a devolver"),
}

export function registerActivityTools(server) {
  server.tool(
    "get_activities",
    "Actividades recientes: potencia, FC, TSS, duración, zonas.",
    dateArgs,
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivities(resolveAthleteId(args), apiKey, args))
    }
  )

  server.tool(
    "get_activity_details",
    "Detalle completo de una actividad puntual (potencia, FC, distancia, zonas, etc.).",
    { activity_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivityDetails(args.activity_id, apiKey))
    }
  )

  server.tool(
    "get_activity_intervals",
    "Intervals detectados de una actividad (potencia, FC, cadencia, etc. por intervalo, incluyendo grupos).",
    { activity_id: z.string() },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivityIntervals(args.activity_id, apiKey))
    }
  )

  server.tool(
    "get_activity_streams",
    "Series de tiempo de una actividad (potencia, FC, cadencia, altitud, distancia, velocidad). Arrays largos vienen truncados a preview (primeros/últimos 5 puntos).",
    {
      activity_id: z.string(),
      types: z.string().optional()
        .describe("Tipos separados por coma, ej. 'time,watts,heartrate'. Default: time,watts,heartrate,cadence,altitude,distance,velocity_smooth"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivityStreams(args.activity_id, apiKey, args))
    }
  )

  server.tool(
    "get_activity_messages",
    "Mensajes/comentarios de chat en una actividad.",
    {
      activity_id: z.string(),
      since_id: z.string().optional().describe("Traer solo mensajes posteriores a este ID"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getActivityMessages(args.activity_id, apiKey, { sinceId: args.since_id }))
    }
  )

  server.tool(
    "post_activity_message",
    "Postea un mensaje/comentario en una actividad (feedback de coaching).",
    { activity_id: z.string(), text: z.string().min(1) },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => postActivityMessage(args.activity_id, apiKey, args.text.trim()))
    }
  )

  server.tool(
    "update_activity",
    "Actualiza metadata de una actividad (nombre, descripción, tipo). Solo se mandan los campos provistos.",
    {
      activity_id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      activity_type: z.string().optional().describe("ej. 'Ride', 'Run', 'Swim'"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => {
        const fields = {}
        if (args.name !== undefined) fields.name = args.name
        if (args.description !== undefined) fields.description = args.description
        if (args.activity_type !== undefined) fields.type = args.activity_type
        if (Object.keys(fields).length === 0) {
          throw new Error("Al menos un campo (name, description o activity_type) debe estar presente.")
        }
        return updateActivity(args.activity_id, apiKey, fields)
      })
    }
  )

  server.tool(
    "delete_activity",
    "Borra PERMANENTEMENTE una actividad de Intervals.icu. Usar solo si el usuario confirmó explícitamente que quiere eliminar esa actividad.",
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
    "Corrige o crea un interval de una actividad (índices dentro de los streams). Para crear uno nuevo, usar un interval_id negativo (ej. -1).",
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
          throw new Error("start_index debe ser menor que end_index.")
        }
        return updateActivityInterval(args.activity_id, args.interval_id, apiKey, {
          startIndex: args.start_index,
          endIndex: args.end_index,
        })
      })
    }
  )
}
