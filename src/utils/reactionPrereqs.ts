import Discord from 'discord.js'
import { ProjectsClient } from '../client'

export function isNotSelf (client: Discord.Client, user: Discord.User): boolean {
  return user.id !== client.user?.id
}

export function isInSubmissionChannel (channel: Discord.TextBasedChannel, client: ProjectsClient): boolean {
  return channel.id === client.config.channels().privateSubmission.id
}

export function isValidEmoji (reaction: Discord.MessageReaction, client: ProjectsClient): boolean {
  const { upvote, downvote, pause } = client.config.emojis()

  // Falling back to empty is ok as it will always return false
  return [upvote, downvote, pause].includes(reaction.emoji.id ?? '')
}

/**
 * Checks that a reaction event passes basic checks:
 *   - Not from the bot
 *   - Is in the submissions channel
 *   - Uses a recognised emoji
 */
export function allPass (
  client: ProjectsClient,
  user: Discord.User,
  channel: Discord.TextBasedChannel,
  reaction: Discord.MessageReaction
): boolean {
  return isNotSelf(client, user) && isInSubmissionChannel(channel, client) && isValidEmoji(reaction, client)
}
