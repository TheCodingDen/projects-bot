import { DiscordAPIError } from 'discord.js'
import { internalLog } from '../communication/internal'

export async function runCatching<T> (fn: () => Promise<T | undefined> | T | undefined): Promise<T> {
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
    }
    // Primitives
    else if (
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

  // Request errors are fatal, we cannot continue, ideally requests never fail anyways
  throw cause
}
