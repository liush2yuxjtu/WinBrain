import { Effect } from 'effect'

export class AppError extends Error {
  readonly _tag = 'AppError'

  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'AppError'
    this.cause = options?.cause
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function tryPromiseEffect<A>(label: string, run: () => Promise<A>): Effect.Effect<A, AppError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => new AppError(`${label}: ${toErrorMessage(cause)}`, { cause })
  })
}

export function trySyncEffect<A>(label: string, run: () => A): Effect.Effect<A, AppError> {
  return Effect.try({
    try: run,
    catch: (cause) => new AppError(`${label}: ${toErrorMessage(cause)}`, { cause })
  })
}

export function runAppEffect<A>(effect: Effect.Effect<A, AppError>): Promise<A> {
  return Effect.runPromise(effect)
}
