// Helpers compartidos por todas las tools: contexto de auth, resolución de
// athlete_id (coach mode), envoltorio de respuesta y manejo de errores.
import { z } from "zod"

// Confirma que hay sesión válida (token → {athleteId, apiKey}). No se usa
// para resolver el athlete_id de las llamadas (ver resolveAthleteId).
export function ctx(extra) {
  const info = extra?.authInfo?.extra
  if (!info?.athleteId || !info?.apiKey) {
    throw new Error("No autenticado: falta el contexto del token")
  }
  return info
}

// "0" es el id especial de Intervals.icu que resuelve al atleta dueño de la
// API key usada en la llamada (Basic Auth) — ver forum.intervals.icu/t/api-access-to-intervals-icu/609.
// Evita depender de un athleteId cacheado en el token: sirve igual para un
// atleta solo o para un coach con múltiples atletas.
export function resolveAthleteId(args) {
  return args?.athlete_id || "0"
}

// Fragmento zod para portar coach-mode sin duplicar código en cada tool.
// El regex es solo para cuando el caller pasa un id explícito; "0" es el
// default interno y no algo que se le pida escribir al modelo.
export const athleteIdArg = {
  athlete_id: z.string().regex(/^i\d+$/).optional()
    .describe("Athlete ID (ej. i218573) para coach mode. Si no se pasa, se usa el atleta dueño de la API key del token."),
}

export function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
}

export async function run(fn) {
  try {
    return ok(await fn())
  } catch (e) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${e.message}` }],
    }
  }
}
