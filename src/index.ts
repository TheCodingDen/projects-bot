import dotenv from 'dotenv-safe'
import { Intents } from 'discord.js'
import eventHandlers from './events'
import { ProjectsClient } from './client'
import { log } from './utils/logger'
import { Result } from 'ts-results'

dotenv.config()

const client = new ProjectsClient({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]
})

for (const [event, handler] of Object.entries(eventHandlers)) {
  client.on(
    event,
    async (...args) => {
      const res = await Result.wrapAsync(async () => await handler(client, ...args))

      if (res.err) {
        log.error(`Encountered unexpected error in event handler ${handler}`)
        log.error(res.val)
      }
    }
  )

  log.debug(`Registered event listener ${event}`)
}

// Load the commands from file
client.commands.init()

// TODO: use top level await if / when we switch to ESM
// After login, register them, we need the client ID so we need to wait for login
void client.login(client.config.botSettings().token)
  // Don't bother catching here, if this goes wrong we have to abort anyways
  // It will throw into the top level and the logs can detail what we were doing at the time
  .then(async () => await client.commands.registerCommands())
