/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone build output — needed to self-host this in Docker (see the
  // homelab's node-service template Dockerfile, which copies .next/standalone).
  // Vercel's own builder ignores this and packages its own way, so it's a
  // no-op for the mcp.gregaria.app deploy.
  output: "standalone",
  // The MCP runs on the Node runtime (uses crypto, fetch with timeout, etc.)
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  // OAuth discovery: the .well-known paths point at real route handlers.
  // The :path* covers variants that append the resource path (e.g. .../api/mcp).
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
