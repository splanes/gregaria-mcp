# gregaria-mcp

Remote MCP for Intervals.icu, for the **Claude app** (mobile/web). Ask "how was my HRV today?"
without keeping your PC on, no VPN, free. Multi-athlete and secure: everyone only sees their own
data.

> Stateless relay: Intervals.icu owns the athlete's login and issues the token; Anthropic
> custodies it between requests. This server never stores or logs anyone's credentials.

## Auth mode

There are two modes, selected via `AUTH_MODE`:

- **`passthrough`** (default, preferred): Intervals.icu is the Authorization Server. Claude
  discovers its OAuth metadata via `/.well-known/oauth-protected-resource` (which points at
  Intervals.icu, not us) and runs the full flow directly with them. This server never sees the
  token — it just forwards it as-is on every MCP request.
- **`proxy`** (fallback, only if Intervals.icu requires a confidential OAuth client): this server
  is the AS that Claude sees, but it relays the code/token exchange against Intervals.icu without
  persisting anything — flow state travels encrypted in the URL (`lib/seal.js`), never in storage.

## How it works (both modes)

```
Claude app  ──custom connector──►  /api/mcp   (Vercel serverless, always-on)
   header: Authorization: Bearer <Intervals.icu token>
                                                     └─ tools → forward the Bearer → Intervals.icu
```

- **Zero credential storage.** No KV, no permanent encryption, no Google login. The only ephemeral
  state (`proxy` mode) is the in-flight OAuth handshake, sealed with `RELAY_SEAL_KEY` and expiring
  in minutes — never written to disk.
- **1 token = 1 athlete**, resolved by Intervals.icu, not by us.
- Read tools plus a handful of write tools (gated by explicit confirmation requested in the tool
  description shown to the model).
- **DoS**: cheap 401 without a token; no request beyond that reaches Intervals.icu unauthenticated.

## Tools

`get_athlete_info` · `get_wellness` · `get_activities` · `get_power_curve` · `get_fitness_summary`
· `get_events` · `analyze_*` · plus a set of write tools (`update_wellness`, `add_or_update_event`,
`post_activity_message`, etc.) gated by explicit confirmation in the prompt.

## Setup

```bash
cp .env.example .env.local
# passthrough: barely anything to fill in (see .env.example).
# proxy: fill in INTERVALS_CLIENT_ID/SECRET, INTERVALS_OAUTH_*, RELAY_SEAL_KEY.
npm install
npm run dev
```

## Deploy (Vercel)

1. Import the repo into Vercel — the default `*.vercel.app` domain works fine, or attach your own.
2. Load the env vars from `.env.local`. `NEXT_PUBLIC_MCP_URL`/`AUTH_URL` are derived from the
   request automatically; only set them if you need to force a specific domain.
3. `AUTH_MODE=passthrough` by default. If Intervals.icu requires a confidential client, switch to
   `proxy` and fill in `INTERVALS_CLIENT_ID/SECRET` + `RELAY_SEAL_KEY`.
4. **Disable Deployment Protection** on the `/api/mcp` route (or use the production domain).

## Add to Claude

[Add custom connector →](https://claude.ai/customize/connectors?modal=add-custom-connector)

Paste `https://<your-domain>/api/mcp` (shown on the deployed `/` page), leave Client ID/Secret
empty. It's OAuth 2.1 + PKCE with dynamic client registration — no token to copy by hand.
Connecting redirects to Intervals.icu (passthrough) or to `/api/oauth/authorize` on your
deployment (proxy) to log in and confirm.

## Known limitations

- **No coach mode (multi-athlete listing) yet.** Intervals.icu's `GET /athletes` needs a scope
  that isn't confirmed on their end, so there are no tools to list or compare multiple athletes at
  once — every tool call resolves a single athlete (the key owner, or an explicit `athlete_id`).
