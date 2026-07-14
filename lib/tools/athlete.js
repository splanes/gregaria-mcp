import { z } from "zod"
import {
  getAthleteInfo,
  getPowerCurve,
  getFitnessSummary,
  getAthleteSportSettings,
  updateSportSettings,
} from "../intervals/index.js"
import { ctx, run, resolveAthleteId, athleteIdArg } from "./shared.js"

export function registerAthleteTools(server) {
  server.tool(
    "get_athlete_info",
    "Athlete profile: FTP, LTHR, power/HR zones, weight.",
    { ...athleteIdArg },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getAthleteInfo(resolveAthleteId(args), apiKey))
    }
  )

  server.tool(
    "get_power_curve",
    "Athlete's power curve (mean-max).",
    {
      ...athleteIdArg,
      period: z.string().optional().describe("e.g. '42d', '90d', '1y' (default 42d)"),
      type: z.string().optional().describe("Activity type, e.g. 'Ride' (default) or 'Run'"),
    },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getPowerCurve(resolveAthleteId(args), apiKey, args))
    }
  )

  server.tool(
    "get_fitness_summary",
    "Fitness/form: CTL, ATL, TSB over time.",
    { ...athleteIdArg, days: z.number().int().positive().max(365).optional().describe("default 42") },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getFitnessSummary(resolveAthleteId(args), apiKey, args))
    }
  )

  server.tool(
    "get_athlete_sport_settings",
    "Per-sport settings: colors, load thresholds, show/hide flags.",
    { ...athleteIdArg, sport: z.string().describe("e.g. 'Ride', 'Run', 'Swim', 'VirtualRide'") },
    async (args, extra) => {
      const { apiKey } = ctx(extra)
      return run(() => getAthleteSportSettings(resolveAthleteId(args), apiKey, args.sport))
    }
  )

  server.tool(
    "update_sport_settings",
    "Updates power/HR zones and thresholds (FTP, LTHR, max HR) for a sport. " +
      "Sport-settings are shared across several related types (e.g. 'Ride' also covers " +
      "GravelRide, VirtualRide, etc.). Only updates the fields sent (merge, doesn't " +
      "erase what's already set). power_zones are % of FTP (upper bound of each zone, the last " +
      "one is usually ~999 = open-ended zone); hr_zones are absolute bpm. If power_zone_names " +
      "or hr_zone_names are passed they must have the same length as their corresponding zones array.",
    {
      ...athleteIdArg,
      sport: z.string().describe("Sport to edit, e.g. 'Ride', 'Run', 'Swim'"),
      ftp: z.number().int().positive().optional().describe("FTP in watts"),
      indoor_ftp: z.number().int().positive().optional().describe("Indoor FTP in watts"),
      lthr: z.number().int().positive().optional().describe("Lactate threshold heart rate (bpm)"),
      max_hr: z.number().int().positive().optional().describe("Max HR (bpm)"),
      power_zones: z.array(z.number().positive()).optional()
        .describe("Upper bounds of power zones, % of FTP, ascending (e.g. [55,75,90,105,120,150,999])"),
      hr_zones: z.array(z.number().positive()).optional()
        .describe("Upper bounds of HR zones, absolute bpm, ascending"),
      power_zone_names: z.array(z.string()).optional().describe("Names of the power zones, same length as power_zones"),
      hr_zone_names: z.array(z.string()).optional().describe("Names of the HR zones, same length as hr_zones"),
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
          throw new Error("At least one field must be present (ftp, indoor_ftp, lthr, max_hr, power_zones, hr_zones, power_zone_names, or hr_zone_names).")
        }
        const current = await getAthleteSportSettings(athleteId, apiKey, args.sport)
        return updateSportSettings(athleteId, apiKey, current.id, fields)
      })
    }
  )
}
