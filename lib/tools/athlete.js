import { z } from "zod"
import {
  getAthleteInfo,
  getPowerCurve,
  getFitnessSummary,
  getAthleteSportSettings,
  listAthletes,
} from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"

export function registerAthleteTools(server) {
  server.tool(
    "get_athlete_info",
    "Perfil del atleta: FTP, LTHR, zonas de potencia/FC, peso.",
    { ...athleteIdArg },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getAthleteInfo(resolveAthleteId(args), apiKey))
    }
  )

  server.tool(
    "get_power_curve",
    "Curva de potencia (mean-max) del atleta.",
    {
      ...athleteIdArg,
      period: z.string().optional().describe("ej. '42d', '90d', '1y' (default 42d)"),
      type: z.string().optional().describe("Tipo de actividad, ej. 'Ride' (default) o 'Run'"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getPowerCurve(resolveAthleteId(args), apiKey, args))
    }
  )

  server.tool(
    "get_fitness_summary",
    "Fitness/form: CTL, ATL, TSB a lo largo del tiempo.",
    { ...athleteIdArg, days: z.number().int().positive().max(365).optional().describe("default 42") },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getFitnessSummary(resolveAthleteId(args), apiKey, args))
    }
  )

  server.tool(
    "get_athlete_sport_settings",
    "Settings por deporte: colores, umbrales de carga, flags show/hide.",
    { ...athleteIdArg, sport: z.string().describe("ej. 'Ride', 'Run', 'Swim', 'VirtualRide'") },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getAthleteSportSettings(resolveAthleteId(args), apiKey, args.sport))
    }
  )

  server.tool(
    "list_athletes",
    "Lista los atletas visibles con esta API key (coach mode): los que seguís/coacheás, incluyéndote a vos. Útil para elegir un athlete_id explícito en el resto de las tools.",
    {},
    async (_args, extra) => {
      const { apiKey } = ctx(extra)
      return run(async () => {
        const athletes = await listAthletes(apiKey)
        return athletes.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          city: a.city,
          country: a.country,
          status: a.status,
        }))
      })
    }
  )
}
