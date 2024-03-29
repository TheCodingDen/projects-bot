/* eslint-disable import/first */

// Env
import dotenv from 'dotenv-safe'
dotenv.config()

// Logger
import logger from './utils/logger'
global.logger = logger

// Main app
import { SlashCreator, GatewayServer } from 'slash-create'
import { Client, GatewayDispatchEvents, GatewayIntentBits } from 'discord.js'
import path from 'path'
import * as api from './api'
import * as exceptions from './utils/exception'
import { handleButtonEvent } from './vote/event'
import { handleMemberLeaveEvent } from './event/memberLeave'
import { internalLog } from './communication/internal'

// Register global exception handler
exceptions.setup()

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
})

export const creator = new SlashCreator({
  applicationID: process.env.DISCORD_APP_ID as string,
  token: process.env.DISCORD_BOT_TOKEN,
  client
})

creator.on('debug', (message) => logger.debug(message))
creator.on('warn', (message) => logger.warn(message))
creator.on('error', (error) => logger.error(error))
creator.on('synced', () => logger.info('Commands synced!'))
creator.on('commandRun', (command, _, ctx) =>
  logger.info(
    `${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}) ran command ${command.commandName}`
  )
)
creator.on('commandRegister', (command) =>
  logger.info(`Registered command ${command.commandName}`)
)
creator.on('commandError', (command, error) => {
  logger.error(`Command ${command.commandName}: ${error.message} \n ${error.stack}`)

  internalLog.error({
    type: 'text',
    content: `Error running command ${command.commandName}: ${error.message} \n ${error.stack}`,
    ctx: undefined
  })
})

// The button events we handle through djs itself
const OUR_BUTTONS = ['pause', 'upvote', 'downvote']

void (async () => {
  creator
    .withServer(
      new GatewayServer((handler) => {
        client.ws.on(GatewayDispatchEvents.InteractionCreate, (data) => {
          // HACK: Don't let it handle button events that we handle
          if (
            data.type === 3 &&
            OUR_BUTTONS.some(
              (a) => data.data.custom_id === a
            )
          ) {
            logger.debug('Disallowing slash-create to handle button event.')
            return
          }

          handler(data)
        })
      })
    )
    .registerCommandsIn(path.join(__dirname, 'commands'))

  // Event setup
  client.on('interactionCreate', async (ev) => {
    if (ev.isButton() && ev.inCachedGuild() && OUR_BUTTONS.some(a => a === ev.component.customId)) {
      await handleButtonEvent(ev)
    }
  })

  client.on('guildMemberRemove', async (...args) => await handleMemberLeaveEvent(...args))

  logger.info('Starting d.js client')
  await client.login(process.env.DISCORD_BOT_TOKEN)
  logger.info(`Logged in as ${client.user?.username ?? 'Unknown#0000'}`)

  logger.info('Starting backend API')
  await api.setup()

  logger.info('Application setup complete.')
})().catch(logger.error)
