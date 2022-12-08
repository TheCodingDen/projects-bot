import { DiscordAPIError } from 'discord.js'
import { internalLog } from '../communication/internal'

// FIXME: better name than "supress"
type CatchBehaviour = 'rethrow' | 'suppress'

/**
 * Run the callback, catching any errors that are thrown from it.
 * If `behaviour` is "supress", `undefined` is returned.
 * If `behaviour` is "rethrow", the caught error is rethrown.
 */
export async function runCatching<T> (fn: () => Promise<T | undefined> | T | undefined, behaviour: 'rethrow'): Promise<T>
export async function runCatching<T> (fn: () => Promise<T | undefined> | T | undefined, behaviour: 'suppress'): Promise<T | undefined>
export async function runCatching<T> (fn: () => Promise<T | undefined> | T | undefined, behaviour: CatchBehaviour): Promise<T | undefined> {
  let msg = 'unknown'
  let cause

  try {
    return await fn()
  } catch (err) {
    if (err === undefined || err === null) {
      msg = 'null'
    } else if (err instanceof DiscordAPIError) {
      msg = `API Error (${err.code}) on ${err.method} => ${err.url} \n ${err.stack}`
    } else if (
      typeof err === 'string' ||
      typeof err === 'number' ||
      typeof err === 'bigint' ||
      typeof err === 'boolean'
    ) {
      msg = `Primitive: ${err.toString()}`
    } else if (err instanceof Error) {
      msg = `Error (${err.name}) ${err.message} \n ${err.stack}`
    }

    // All objects have this function, it just might not be overriden
    // we are attempting a last ditch effort to get *some* logs out.
    msg = (err as any)?.toString() ?? 'unknown'

    logger.error('Request failure:')
    logger.error(err)

    // Set the cause for later throwing, outside of this scope
    cause = err
  }

  internalLog.error({
    type: 'text',
    content: `Request failure: ${msg}`,
    ctx: undefined
  })

  if (behaviour === 'suppress') {
    return undefined
  }

  // Request errors are fatal, we cannot continue, ideally requests never fail anyways
  throw cause
}
