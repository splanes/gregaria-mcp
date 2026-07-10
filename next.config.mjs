/** @type {import('next').NextConfig} */
const nextConfig = {
  // El MCP corre en Node runtime (usa crypto, fetch con timeout, etc.)
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  // OAuth discovery: los .well-known apuntan a route handlers reales.
  // El :path* cubre las variantes que agregan el resource path (ej. .../api/mcp).
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/well-known/oauth-protected-resource",
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/well-known/oauth-protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/well-known/oauth-authorization-server",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/well-known/oauth-authorization-server",
      },
    ]
  },
}

export default nextConfig
