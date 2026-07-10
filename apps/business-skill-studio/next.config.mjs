import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  serverExternalPackages: ['@anthropic-ai/claude-agent-sdk']
}

export default nextConfig
