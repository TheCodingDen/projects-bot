import dotenv from 'dotenv-safe'
import Discord, { Client, Intents } from 'discord.js'
import * as logger from './utils/logger'
import eventHandlers from './events'
import ensureRequiredDirectories from './utils/ensureRequiredDirectories'

global.log = logger.init()
dotenv.config()
ensureRequiredDirectories()

const client = new Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]
})

for (const event in eventHandlers) {
  // Have to do this here because type annotations can't be set for left-hand side ops in loops
  const currentEvent = event as keyof Discord.ClientEvents
  const currentEventHandler = eventHandlers[currentEvent]

  // Have to check for undefined here to stop TS screeching that the function might be undefined
  // Which in turn happens due to the black magic typecasting I have to do in order to get plug-and-play event handler imports working
  if (currentEventHandler) {
    client.on(
      currentEvent,
      (...params) => currentEventHandler(client, ...params)
    )
  }
}

void client.login(process.env.DISCORD_CLIENT_TOKEN)
