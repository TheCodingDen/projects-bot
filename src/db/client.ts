import { PrismaClient } from '@prisma/client'
import { internalLog } from '../communication/internal'

export const db = new PrismaClient()

export async function query<T> (fn: (db: PrismaClient) => T): Promise<T> {
  try {
    return fn(db)
  } catch (err) {
    internalLog.error(`Database returned an error: ${err}`, undefined)
    logger.error(`Database returned an error: ${err}`)
    throw err
  }
}
