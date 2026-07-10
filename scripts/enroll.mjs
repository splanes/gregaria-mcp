#!/usr/bin/env node
// CLI de admin. Alta / baja / listado de atletas.
//
//   node scripts/enroll.mjs --name "Sebas" --athlete i218573 --key <API_KEY>
//   node scripts/enroll.mjs --list
//   node scripts/enroll.mjs --revoke tok_xxx
//
// Usa las mismas env vars que el server (ENCRYPTION_KEY, UPSTASH_*). Carga .env.local / .env.
import { readFile } from "fs/promises"

async function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = await readFile(f, "utf8")
      for (const line of txt.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
        }
      }
    } catch {
      /* archivo ausente, ok */
    }
  }
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith("--")) {
        args[key] = next
        i++
      } else {
        args[key] = true
      }
    }
  }
  return args
}

async function main() {
  await loadEnv()
  const args = parseArgs(process.argv.slice(2))

  if (!process.env.ENCRYPTION_KEY) {
    console.error("✗ Falta ENCRYPTION_KEY (openssl rand -hex 32) en .env.local")
    process.exit(1)
  }

  const { enroll, revoke } = await import("../lib/enroll.js")
  const { listRows } = await import("../lib/store.js")

  if (args.list) {
    const rows = await listRows()
    if (!rows.length) return console.log("(sin altas)")
    for (const r of rows) {
      console.log(`  ${r.athlete_id.padEnd(10)}  ${r.name || "-"}   ${r.created_at || ""}   [${r.tokenHash.slice(0, 12)}…]`)
    }
    return
  }

  if (args.revoke) {
    const ok = await revoke(String(args.revoke))
    console.log(ok ? "✓ revocado" : "✗ token no encontrado")
    return
  }

  if (!args.athlete || !args.key) {
    console.error("Uso: --name <n> --athlete iXXXXX --key <API_KEY>  |  --list  |  --revoke <token>")
    process.exit(1)
  }

  const { token } = await enroll({
    name: args.name,
    athleteId: String(args.athlete),
    apiKey: String(args.key),
  })

  const url = process.env.NEXT_PUBLIC_MCP_URL || "https://mcp.gregaria.app/api/mcp"
  console.log("\n✓ Alta creada. Pasale al atleta (el token se muestra 1 sola vez):\n")
  console.log(`  Token:   ${token}`)
  console.log(`  URL:     ${url}`)
  console.log(`  Header:  Authorization: Bearer ${token}\n`)
}

main().catch((e) => {
  console.error("✗", e.message)
  process.exit(1)
})
