import Discord from 'discord.js'

export function isNotSelf (client: Discord.Client, user: Discord.User): boolean {
  return user.id !== client.user?.id
}

export function isInSubmissionChannel (channel: Discord.TextBasedChannel): boolean {
  return channel.id === process.env.PROJECT_SUBMISSIONS_CHANNEL
}

export function isValidEmoji (reaction: Discord.MessageReaction): boolean {
  switch (reaction.emoji.id) {
    case process.env.UPVOTE_REACTION:
    case process.env.DOWNVOTE_REACTION:
    case process.env.PAUSE_REACTION:
      return true
    default:
      return false
  }
}

export function allPass (
  client: Discord.Client,
  user: Discord.User,
  channel: Discord.TextBasedChannel,
  reaction: Discord.MessageReaction
): boolean {
  return isNotSelf(client, user) && isInSubmissionChannel(channel) && isValidEmoji(reaction)
}
