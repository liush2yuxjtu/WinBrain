/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@anthropic-ai/claude-agent-sdk',
    '@prisma/adapter-pg'
  ]
}

export default nextConfig
