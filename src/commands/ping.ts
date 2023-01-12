import { SlashCommand, SlashCreator, CommandContext } from 'slash-create'
import { client } from '..'
import { getAssignedGuilds } from '../utils/discordUtils'

export default class PingCommand extends SlashCommand {
  constructor (creator: SlashCreator) {
    super(creator, {
      name: 'ping',
      description: 'Check whether the bot is responding.',
      guildIDs: getAssignedGuilds({ includeMain: true })
    })
  }

  async run (_ctx: CommandContext): Promise<string> {
    const ping = client.ws.ping
    logger.info(`Ping: ${ping}`)
    return `Pong! WebSocket ping: ${ping}ms`
  }
}
