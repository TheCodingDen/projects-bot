import { Err, Ok, Result } from 'ts-results'
import { startAPI } from '../api'
import { ProjectsClient } from '../client'
import { log } from '../utils/logger'

export default (client: ProjectsClient): Result<void, Error> => {
  log.info(`Logged in as ${client.user?.tag ?? ''}`)

  const { message, type } = client.config.presenceSettings()

  try {
    // This doesnt return a promise? I guess it's sync..? I wouldn't expect it to be..?
    void client.user?.setPresence({
      status: 'online',
      activities: [
        {
          name: message,
          // Because DJS only accepts a subset of strings (that we cant know)
          // .. and this type is hard to access .. we will just cast to any.
          // This is very bad but its the only non trivial way to solve this problem.
          // Casting to the "correct" type has the same implications as any
          type: type as any
        }

      ]
    })
  } catch (err) {
    log.error(`Could not set startup presence: ${err}`)

    return Err(err as Error)
  }

  log.info('Starting backend API..')

  startAPI(client)

  log.info('Started API!')

  return Ok.EMPTY
}
