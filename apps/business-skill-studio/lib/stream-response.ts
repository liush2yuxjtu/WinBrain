type StreamEvent = Record<string, unknown> & { type?: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function progressiveJsonResponse(events: AsyncIterable<StreamEvent>): Response {
  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let first = true
      let finalEvent: StreamEvent | undefined
      let failure: string | undefined

      controller.enqueue(encoder.encode('{"events":[\n'))

      const enqueueEvent = (event: StreamEvent) => {
        const prefix = first ? '' : ','
        first = false
        controller.enqueue(encoder.encode(`${prefix}${JSON.stringify(event)}\n`))
      }

      try {
        for await (const event of events) {
          if (event.type === 'result') finalEvent = event
          enqueueEvent(event)
        }
      } catch (error) {
        failure = errorMessage(error)
        enqueueEvent({
          type: 'error',
          error: failure
        })
      }

      if (!failure && !finalEvent) {
        failure = 'Stream ended without a final result event.'
        enqueueEvent({
          type: 'error',
          error: failure
        })
      }

      const rootFields = failure
        ? { ok: false, error: failure }
        : {
            ok: true,
            ...Object.fromEntries(Object.entries(finalEvent as StreamEvent).filter(([key]) => key !== 'type'))
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
