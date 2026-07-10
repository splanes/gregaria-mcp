// Tools READ-ONLY del MCP. Cada uno usa el athleteId + apiKey que resolvió
// el auth del token (extra.authInfo.extra), NUNCA un athlete_id de argumento.
// Cubren el Step 0 del protocolo de gregaria (data-acquisition).
import { z } from "zod"
import {
  getAthleteInfo,
  getWellness,
  getActivities,
  getPowerCurve,
  getFitnessSummary,
} from "./intervals.js"

function ctx(extra) {
  const info = extra?.authInfo?.extra
  if (!info?.athleteId || !info?.apiKey) {
    throw new Error("No autenticado: falta el contexto del token")
  }
  return info
}

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
}

async function run(fn) {
  try {
    return ok(await fn())
  } catch (e) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${e.message}` }],
    }
  }
}

const dateArgs = {
  days: z.number().int().positive().max(365).optional()
    .describe("Ventana en días hacia atrás (default 14 wellness/activities)"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
}

export function registerTools(server) {
  server.tool(
    "get_athlete_info",
    "Perfil del atleta: FTP, LTHR, zonas de potencia/FC, peso.",
    {},
    async (_args, extra) => {
      const { athleteId, apiKey } = ctx(extra)
      return run(() => getAthleteInfo(athleteId, apiKey))
    }
  )

  server.tool(
    "get_wellness",
    "Métricas de recuperación: HRV, RHR, sueño, feel subjetivo (para '¿cómo estuvo mi HRV hoy?').",
    dateArgs,
    async (args, extra) => {
      const { athleteId, apiKey } = ctx(extra)
      return run(() => getWellness(athleteId, apiKey, args))
    }
  )

  server.tool(
    "get_activities",
    "Actividades recientes: potencia, FC, TSS, duración, zonas.",
    dateArgs,
    async (args, extra) => {
      const { athleteId, apiKey } = ctx(extra)
      return run(() => getActivities(athleteId, apiKey, args))
    }
  )

  server.tool(
    "get_power_curve",
    "Curva de potencia (mean-max) del atleta.",
    {
      period: z.string().optional().describe("ej. '42d', '90d', '1y' (default 42d)"),
      type: z.string().optional().describe("Tipo de actividad, ej. 'Ride' (default) o 'Run'"),
    },
    async (args, extra) => {
      const { athleteId, apiKey } = ctx(extra)
      return run(() => getPowerCurve(athleteId, apiKey, args))
    }
  )

  server.tool(
    "get_fitness_summary",
    "Fitness/form: CTL, ATL, TSB a lo largo del tiempo.",
    { days: z.number().int().positive().max(365).optional().describe("default 42") },
    async (args, extra) => {
      const { athleteId, apiKey } = ctx(extra)
      return run(() => getFitnessSummary(athleteId, apiKey, args))
    }
  )
}
