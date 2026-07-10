import { z } from "zod"
import { getWellness } from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"

const dateArgs = {
  ...athleteIdArg,
  days: z.number().int().positive().max(365).optional()
    .describe("Ventana en días hacia atrás (default 14)"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
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
}
