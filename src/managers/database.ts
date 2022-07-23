import { Manager } from '.'
import { ProjectsClient } from '../client'
import { PrismaClient } from '@prisma/client'
import { log } from '../utils/logger'
import { Result } from 'ts-results'

export class DatabaseManager extends Manager {
  private readonly db: PrismaClient

  constructor (client: ProjectsClient) {
    super(client)

    this.db = new PrismaClient()
  }

  /**
   * Executes a DB query, catching any errors that occur during its execution.
   * If the callback returns a Promise, this will wait for its completion.
   */
  async exec<T>(fn: (db: PrismaClient) => T | Promise<T>): Promise<Result<T, Error>> {
    const cbRes = await Result.wrapAsync(async () => await fn(this.db))

    return cbRes.mapErr(err => {
      log.error(`Encountered error whilst running DB request ${err}`)
      log.error(err)

      return err as Error
    })
  }
}
