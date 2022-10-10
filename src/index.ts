/* eslint-disable import/first */

// Env
import dotenv from 'dotenv-safe'
dotenv.config()

// Logger
import logger from './utils/logger'
global.logger = logger

// Main app
import { SlashCreator, GatewayServer } from 'slash-create'
import Discord, { GatewayDispatchEvents } from 'discord.js'
import path from 'path'

export const client = new Discord.Client({
  intents: []
})

const creator = new SlashCreator({
  applicationID: process.env.DISCORD_APP_ID as string,
  publicKey: process.env.DISCORD_PUBLIC_KEY,
  token: process.env.DISCORD_BOT_TOKEN,
  client
})

creator.on('debug', message => logger.debug(message))
creator.on('warn', message => logger.warn(message))
creator.on('error', error => logger.error(error))
creator.on('synced', () => logger.info('Commands synced!'))
creator.on('commandRun', (command, _, ctx) =>
  logger.info(`${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}) ran command ${command.commandName}`)
)
creator.on('commandRegister', command => logger.info(`Registered command ${command.commandName}`))
creator.on('commandError', (command, error) => logger.error(`Command ${command.commandName}:`, error))

void (async () => {
  creator
    .withServer(
      new GatewayServer(
        (handler) => client.ws.on(GatewayDispatchEvents.InteractionCreate, handler)
      )
    )
    .registerCommandsIn(path.join(__dirname, 'commands'))

  await client.login(process.env.DISCORD_BOT_TOKEN)
  logger.info(`Logged in as ${client.user?.username ?? 'Unknown#0000'}`)
})()
