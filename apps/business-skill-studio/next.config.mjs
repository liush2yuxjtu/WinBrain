/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverExternalPackages: ['@anthropic-ai/claude-agent-sdk']
  }
}

export default nextConfig
