import { z } from "zod"
import {
  getAthleteInfo,
  getPowerCurve,
  getFitnessSummary,
  getAthleteSportSettings,
  updateSportSettings,
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
    "update_sport_settings",
    "Actualiza zonas de potencia/FC y umbrales (FTP, LTHR, max HR) de un deporte. " +
      "El sport-settings es compartido por varios tipos relacionados (ej. el de 'Ride' cubre " +
      "también GravelRide, VirtualRide, etc.). Solo actualiza los campos enviados (merge, no " +
      "borra lo ya cargado). power_zones son % de FTP (límite superior de cada zona, última " +
      "suele ser ~999 = zona abierta); hr_zones son bpm absolutos. Si se pasan power_zone_names " +
      "u hr_zone_names deben tener el mismo largo que su array de zonas correspondiente.",
    {
      ...athleteIdArg,
      sport: z.string().describe("Deporte a editar, ej. 'Ride', 'Run', 'Swim'"),
      ftp: z.number().int().positive().optional().describe("FTP en watts"),
      indoor_ftp: z.number().int().positive().optional().describe("FTP indoor en watts"),
      lthr: z.number().int().positive().optional().describe("Lactate threshold heart rate (bpm)"),
      max_hr: z.number().int().positive().optional().describe("FC máxima (bpm)"),
      power_zones: z.array(z.number().positive()).optional()
        .describe("Límites superiores de zonas de potencia, % de FTP, ascendente (ej. [55,75,90,105,120,150,999])"),
      hr_zones: z.array(z.number().positive()).optional()
        .describe("Límites superiores de zonas de FC, bpm absolutos, ascendente"),
      power_zone_names: z.array(z.string()).optional().describe("Nombres de las zonas de potencia, mismo largo que power_zones"),
      hr_zone_names: z.array(z.string()).optional().describe("Nombres de las zonas de FC, mismo largo que hr_zones"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(async () => {
        const athleteId = resolveAthleteId(args)
        const fields = {}
        if (args.ftp !== undefined) fields.ftp = args.ftp
        if (args.indoor_ftp !== undefined) fields.indoor_ftp = args.indoor_ftp
        if (args.lthr !== undefined) fields.lthr = args.lthr
        if (args.max_hr !== undefined) fields.max_hr = args.max_hr
        if (args.power_zones !== undefined) fields.power_zones = args.power_zones
        if (args.hr_zones !== undefined) fields.hr_zones = args.hr_zones
        if (args.power_zone_names !== undefined) fields.power_zone_names = args.power_zone_names
        if (args.hr_zone_names !== undefined) fields.hr_zone_names = args.hr_zone_names
        if (Object.keys(fields).length === 0) {
          throw new Error("Al menos un campo debe estar presente (ftp, indoor_ftp, lthr, max_hr, power_zones, hr_zones, power_zone_names o hr_zone_names).")
        }
        const current = await getAthleteSportSettings(athleteId, apiKey, args.sport)
        return updateSportSettings(athleteId, apiKey, current.id, fields)
      })
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
