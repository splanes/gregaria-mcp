# Port completo de intervals-mcp-server (Python) a gregaria-mcp (JS)

## Contexto

`gregaria-mcp` es un server MCP "bebé": 5 tools read-only (`get_athlete_info`,
`get_wellness`, `get_activities`, `get_power_curve`, `get_fitness_summary`) sobre
`lib/intervals.js` (cliente fetch + Basic auth) y `lib/tools.js` (registro de tools
con zod). El repo hermano `intervals-mcp-server` (Python/FastMCP) tiene 21 tools
completas: CRUD de actividades, intervals, streams, mensajes, eventos del
calendario, y tools de análisis agregado (`analyze_activity`, `analyze_progress`,
`analyze_training_load`).

El usuario pidió paridad completa, incluyendo las tools destructivas
(`delete_activity`, `delete_event`, `delete_events_by_date_range`) y soporte
multi-atleta ("coach mode": una API key puede ver N atletas vía `list_athletes`,
y cada tool acepta un `athlete_id` opcional). Si no viene `athlete_id`, se usa
`"0"` — el id especial de Intervals.icu que resuelve al atleta dueño de la API
key usada en la llamada (Basic Auth), no un valor cacheado del enroll. Esto es
una decisión consciente del usuario — el server deja de ser puramente
read-only.

Simplificaciones deliberadas frente al Python (para no gastar tiempo/tokens en
lógica de bajo valor):
- **Sin formateo a texto/Markdown.** El Python arma reportes de texto enormes
  (`format_activity_summary`, `format_intervals`, etc.). Acá seguimos el patrón
  actual: devolver JSON crudo vía `ok()`. Un LLM lee JSON estructurado igual de
  bien y nos ahorra ~la mitad del código Python.
- **Sin el bug del peso hardcodeado (71.1kg)** en power-curves: no calculamos
  W/kg del lado del server; si Claude lo necesita, cruza `get_athlete_info`
  (peso real) con `get_power_curve` él mismo.
- **`add_or_update_event`: sin el DSL `WorkoutDoc`** (Value/Step/WorkoutDoc,
  la pieza más compleja del Python). Aceptamos `description` como string libre
  y, si se pasa `workout_doc`, lo serializamos con `JSON.stringify` tal cual
  en vez de reimplementar el renderer de texto. Cubre el caso de uso real
  (crear/editar eventos) sin la DSL de entrenamientos estructurados.
- **Sin el backfill recursivo de `get_activities`** (ventana de 60 días extra
  si hay pocas actividades "nombradas"): pass-through simple de `limit`/fechas.
- Sí portamos la única salvaguarda de tamaño de respuesta que importa:
  truncar preview de `get_activity_streams` (arrays de miles de puntos) a
  primeros 5 + últimos 5 si superan un umbral, igual que el Python.

## Archivos

**Cliente (`lib/intervals/`, reemplaza `lib/intervals.js`):**
- `client.js` — `request(method, path, apiKey, {params, body, ignore404})`:
  Basic auth (igual que hoy), timeout 10s, mapeo de errores 401/403/404/422/429/500/503
  a mensajes claros (extiende el mapeo que ya existe en `lib/intervals.js:22-26`).
- `activities.js` — getActivities, getActivityDetails, getActivityIntervals,
  getActivityStreams (con truncado preview), updateActivity, deleteActivity,
  updateActivityInterval, getActivityMessages, postActivityMessage.
- `athlete.js` — getAthleteInfo, getPowerCurve, getFitnessSummary (las 3 ya
  existentes, se mueven tal cual), + getAthleteSportSettings, listAthletes.
- `events.js` — getEvents, getEventById, addOrUpdateEvent, deleteEvent,
  deleteEventsByDateRange (fetch-then-delete-loop, igual que el Python).
- `wellness.js` — getWellness (ya existente, se mueve tal cual).
- `index.js` — re-exporta todo, un solo import path para las tools.

**Tools (`lib/tools/`, reemplaza `lib/tools.js`):**
- `shared.js` — `ctx(extra)`, `ok()`, `run()` (movidos de `lib/tools.js:13-34`),
  + `resolveAthleteId(args)` → `args.athlete_id ?? "0"`. `"0"` es el id
  especial de Intervals.icu que resuelve al atleta dueño de la API key usada
  en la llamada (Basic Auth), documentado en el foro de la API
  (forum.intervals.icu/t/api-access-to-intervals-icu/609): "use '0' for the
  athlete id for endpoints that accept an athlete id in the path". Evita
  depender de que el token tenga un `athleteId` "correcto" guardado — sirve
  igual para un token de un atleta solo o de un coach con múltiples atletas.
  `ctx(extra)` sigue chequeando `extra.authInfo.extra` solo para confirmar que
  hay sesión válida (no para el fallback de athlete_id). El fragmento zod
  `athleteIdArg = { athlete_id: z.string().regex(/^i\d+$/).optional() }` se
  mantiene para cuando el caller SÍ pasa un id explícito — `"0"` es solo el
  default interno, no algo que se le pida escribir al modelo.
- `activities.js`, `athlete.js`, `events.js`, `wellness.js` — registran las
  tools de su dominio (misma forma que las 5 actuales en `lib/tools.js:44-95`).
- `analysis.js` — `analyze_activity`, `analyze_progress`, `analyze_training_load`:
  fan-out a 3-4 llamadas del cliente + agregación en JS (conteos, sumas,
  promedios, buckets de carga semanal, recomendaciones basadas en reglas) tal
  como en `analysis.py`, pero devolviendo un objeto JSON en vez de Markdown.
- `index.js` — `registerTools(server)` que llama a cada `register*Tools(server)`.

**Tools destructivas:** `delete_activity`, `delete_event`,
`delete_events_by_date_range` llevan en su `description` una advertencia
explícita ("Borra PERMANENTEMENTE...") para que el modelo no las use por error.

**Wiring:** `app/api/[transport]/route.js:7` — cambiar el import a
`"../../../lib/tools/index.js"`. Sin más cambios ahí (el flujo de auth ya
inyecta `{athleteId, apiKey}` en `extra.authInfo.extra`, eso no cambia).

**Borrar:** `lib/intervals.js` y `lib/tools.js` (contenido migrado a los dirs).

## Verificación

1. `npm run build` (o `next lint`) para chequear sintaxis/tipos de las ~23 tools.
2. `npm run dev` + usar el token ya enrolado en `.data/store.json` (dev store
   local, ver `lib/store.js`) contra el endpoint MCP local, probando a mano
   unas pocas tools nuevas de lectura (`get_activity_details`, `list_athletes`,
   `get_events`) con datos reales del atleta.
3. Probar `resolveAthleteId`: llamar `get_athlete_info` sin `athlete_id`
   (debe resolver `"0"` → tu propio atleta) y de nuevo pasando tu `athlete_id`
   real explícito, y confirmar que ambas devuelven el mismo resultado.
4. Para `add_or_update_event`/`delete_event`: crear un evento de prueba
   (barato/no destructivo) y borrarlo, confirmando el ciclo completo.
   **No** ejercitar `delete_activity` contra datos reales — se revisa por
   lectura de código en vez de probarla en vivo.
