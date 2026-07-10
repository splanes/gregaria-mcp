# gregaria-mcp

MCP remoto de Intervals.icu para la **app de Claude** (móvil/web). Preguntá "¿cómo estuvo mi HRV
hoy?" sin depender de tu PC prendida, sin VPN, gratis. Multi-atleta y seguro: cada uno accede solo
a lo suyo.

> La lancha. No monta nada sobre `gregaria-ai` — solo reusa sus piezas chicas probadas
> (cifrado AES-GCM, basic-auth de Intervals, patrón de Google login).

## Cómo funciona

```
App de Claude  ──custom connector──►  /api/mcp   (Vercel serverless, always-on)
   header: Authorization: Bearer <token>            │
                                                     ├─ Bearer → sha256 → KV → {athlete_id, key cifrada}
                                                     ├─ decrypt(ENCRYPTION_KEY)  (el modelo NUNCA ve la key)
                                                     └─ tools READ-ONLY → Intervals.icu
```

- **La API key vive server-side, cifrada** (AES-256-GCM). Claude nunca la ve.
- **1 token = 1 atleta**: el token de X no puede leer a Y.
- **Read-only**: no se puede ensuciar data por el MCP.
- **Enroll no anónimo**: la web self-serve va detrás de Google login + allowlist.
- **DoS**: 401 barato sin token + rate-limit 60/min por token.

## Tools

`get_athlete_info` · `get_wellness` · `get_activities` · `get_power_curve` · `get_fitness_summary`

## Setup

```bash
cp .env.example .env.local
# completar: ENCRYPTION_KEY (openssl rand -hex 32), UPSTASH_*, AUTH_GOOGLE_*, AUTH_SECRET, ALLOWED_EMAILS
npm install
npm run dev
```

Sin Upstash configurado, el store cae a `.data/store.json` (solo dev) — sirve para probar la CLI y
el MCP inspector localmente.

## Alta de un atleta

**CLI (admin):**
```bash
node scripts/enroll.mjs --name "Sebas" --athlete i218573 --key <API_KEY>
node scripts/enroll.mjs --list
node scripts/enroll.mjs --revoke tok_xxx
```

**Web (self-serve):** el atleta entra a `/connect`, se loguea con Google (email en `ALLOWED_EMAILS`),
pega su API key de Intervals y recibe su token. Vos nunca ves su key.

## Cómo obtener la API key de Intervals.icu

1. intervals.icu → login → avatar → **Settings**.
2. Bajar a **Developer Settings** → copiar **API Key**.
3. El **Athlete ID** es el `iXXXXX` de la URL del perfil.

## Deploy (Vercel)

1. Importar el repo en Vercel. Dominio `mcp.gregaria.app`.
2. Cargar las env vars (mismas de `.env.local`, con `NEXTAUTH_URL`/`AUTH_URL` = dominio prod).
3. Agregar la integración **Upstash Redis** (marketplace) → inyecta `UPSTASH_REDIS_REST_*`.
4. Google Cloud → OAuth client → redirect URI `https://mcp.gregaria.app/api/auth/callback/google`.
5. **Desactivar Deployment Protection** en la ruta `/api/mcp` (o usar el dominio de producción).

## Agregar en Claude

App de Claude → **Settings → Connectors → Add custom connector**:
- URL: `https://mcp.gregaria.app/api/mcp`
- Header: `Authorization: Bearer <token>`
