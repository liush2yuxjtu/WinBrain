type StreamEvent = Record<string, unknown> & { type?: string }

export function progressiveJsonResponse(events: AsyncIterable<StreamEvent>): Response {
  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let first = true
      let finalEvent: StreamEvent | undefined

      controller.enqueue(encoder.encode('{"events":[\n'))

      try {
        for await (const event of events) {
          if (event.type === 'result') finalEvent = event
          const prefix = first ? '' : ','
          first = false
          controller.enqueue(encoder.encode(`${prefix}${JSON.stringify(event)}\n`))
        }
      } catch (error) {
        finalEvent = {
          type: 'result',
          text: '',
          usedLiveModel: false,
          usedAgentSdk: false,
          provider: 'claude-agent-sdk',
          warnings: [`Streaming response failed: ${error instanceof Error ? error.message : String(error)}`]
        }
        const prefix = first ? '' : ','
        controller.enqueue(encoder.encode(`${prefix}${JSON.stringify(finalEvent)}\n`))
      }

      const rootFields = finalEvent
        ? Object.fromEntries(Object.entries(finalEvent).filter(([key]) => key !== 'type'))
        : {
            text: '',
            usedLiveModel: false,
            usedAgentSdk: false,
            provider: 'claude-agent-sdk',
            warnings: ['Stream ended without a final result event.']
          }

      const rootJson = JSON.stringify(rootFields)
      controller.enqueue(encoder.encode(`],${rootJson.slice(1)}`))
      controller.close()
    }
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no'
    }
  })
}
