type StreamEvent = Record<string, unknown> & { type?: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function progressiveJsonResponse(events: AsyncIterable<StreamEvent>): Response {
  const encoder = new TextEncoder()
  let isCancelled = false

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let first = true
      let finalEvent: StreamEvent | undefined
      let failure: string | undefined

      const safeEnqueue = (data: Uint8Array): boolean => {
        if (isCancelled) return false
        try {
          controller.enqueue(data)
          return true
        } catch {
          isCancelled = true
          return false
        }
      }

      const enqueueEvent = (event: StreamEvent): boolean => {
        const prefix = first ? '' : ','
        if (!safeEnqueue(encoder.encode(`${prefix}${JSON.stringify(event)}\n`))) return false
        first = false
        return true
      }

      if (!safeEnqueue(encoder.encode('{"events":[\n'))) return

      try {
        for await (const event of events) {
          if (isCancelled) break
          if (event.type === 'result') finalEvent = event
          if (!enqueueEvent(event)) break
        }
      } catch (error) {
        if (isCancelled) return
        failure = errorMessage(error)
        enqueueEvent({ type: 'error', error: failure })
      }

      if (isCancelled) return

      if (!failure && !finalEvent) {
        failure = 'Stream ended without a final result event.'
        enqueueEvent({ type: 'error', error: failure })
      }

      if (isCancelled) return

      const rootFields = failure
        ? { ok: false, error: failure }
        : {
            ok: true,
            ...Object.fromEntries(Object.entries(finalEvent as StreamEvent).filter(([key]) => key !== 'type'))
          }

      const rootJson = JSON.stringify(rootFields)
      if (!safeEnqueue(encoder.encode(`],${rootJson.slice(1)}`))) return

      try {
        controller.close()
      } catch {
        isCancelled = true
      }
    },
    cancel() {
      isCancelled = true
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
