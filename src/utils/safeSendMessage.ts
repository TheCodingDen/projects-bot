import Discord from 'discord.js'

export default async (
  channel: Discord.TextBasedChannel,
  content: string,
  options?: Discord.MessageOptions | Discord.MessageEmbed
): Promise<Discord.Message | undefined> => {
  try {
    return await channel.send({ content, ...options })
  } catch (err) {
    log.error(`Failed to send message to channel ${channel.id}: ${err}`)
  }
}
