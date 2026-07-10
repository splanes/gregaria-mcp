/** @type {import('next').NextConfig} */
const nextConfig = {
  // El MCP corre en Node runtime (usa crypto, fetch con timeout, etc.)
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
}

export default nextConfig
