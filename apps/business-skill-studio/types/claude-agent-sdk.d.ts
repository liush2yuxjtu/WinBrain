declare module '@anthropic-ai/claude-agent-sdk' {
  export function query(input: unknown): AsyncIterable<unknown> | Promise<AsyncIterable<unknown> | unknown[] | unknown>
}
