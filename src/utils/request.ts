import { DiscordAPIError } from 'discord.js'
import { internalLog } from '../communication/internal'

// FIXME: better name than "supress"
type CatchBehaviour = 'rethrow' | 'supress'

/**
 * Run the callback, catching any errors that are thrown from it.
 * If `behaviour` is "supress", `undefined` is returned.
 * If `behaviour` is "rethrow", the caught error is rethrown.
 */
export async function runCatching<T> (fn: () => Promise<T | undefined> | T | undefined, behaviour: 'rethrow'): Promise<T>
export async function runCatching<T> (fn: () => Promise<T | undefined> | T | undefined, behaviour: 'supress'): Promise<T | undefined>
export async function runCatching<T> (fn: () => Promise<T | undefined> | T | undefined, behaviour: CatchBehaviour): Promise<T | undefined> {
  let msg = 'unknown'
  let cause

  try {
    const res = await fn()

    if (res) {
      return res
    }

    msg = 'Value was not present'
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
    }

    cause = err
  }

  internalLog.error(`Request failure: ${msg}`, undefined)

  if (behaviour === 'supress') {
    return undefined
  }

  // Request errors are fatal, we cannot continue, ideally requests never fail anyways
  throw cause
}