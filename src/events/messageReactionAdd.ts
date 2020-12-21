import Discord from 'discord.js'
import safeSendMessage from '../utils/safeSendMessage'
import { getProject, adjustUpvotesForProject, adjustDownvotesForProject, suspendVotingForProject } from '../db'
import showcase from '../utils/postShowcase'
import { ShowcaseDiscordData, ShowcaseData } from '../typings/interfaces'

export default async (client: Discord.Client, reaction: Discord.MessageReaction, user: Discord.User): Promise<Discord.Message | undefined> => {
  // Ensure reaction was not added in DM, even though the ID check would already technically speaking prevent this
  if (reaction.message.guild) {
    const { id, channel, guild } = reaction.message
    const { emoji } = reaction

    const isNotSelf = user.id !== client.user?.id
    const isInSubmissionChannel = channel.id === process.env.PROJECT_SUBMISSIONS_CHANNEL
    const isValidEmoji = emoji.id === process.env.UPVOTE_REACTION ||
      emoji.id === process.env.DOWNVOTE_REACTION ||
      emoji.name === process.env.PAUSE_REACTION

    // Check that project exists

    let projectExists

    try {
      projectExists = !!(await getProject(id))
    } catch (err) {
      return await safeSendMessage(channel, `<@${user.id}>: ⚠️ Your vote was not possible to register. (Failed to validate that message is project)`)
    }

    // Check that preflights pass
    if (isNotSelf && isInSubmissionChannel && projectExists && isValidEmoji) {
      let member

      // Get reacting member
      try {
        member = await guild?.members.fetch(user.id)
      } catch (err) {
        log.error(`Could not fetch reacting member: ${err}`)
        return await safeSendMessage(channel, `<@${user.id}>: ⚠️ Your vote was not possible to register due to identification failure. (Discord error)`)
      }

      // Check that member existed in cache
      if (!member) {
        return await safeSendMessage(channel, `<@${user.id}> ⚠️ Your vote was not possible to register due to identification failure. (Member not found in guild)`)
      }

      // Don't need to check downvote separately, as that would be the only other condition here
      const isUpvote = emoji.id === process.env.UPVOTE_REACTION
      const isPause = emoji.name === process.env.PAUSE_REACTION

      let result
      if (isUpvote) { // Upvote
        result = await adjustUpvotesForProject('add', id, member)
      } else if (isPause) { // Pause
        result = await suspendVotingForProject(true, id, member)
      } else { // Downvote
        result = await adjustDownvotesForProject('add', id, member)
      }

      const input: ShowcaseData = {
        result,
        isPause
      }

      const discordInput: ShowcaseDiscordData = {
        guild,
        channel,
        user,
        reaction
      }

      try {
        await showcase(discordInput, input)
      } catch (err) {
        log.error(`Got error during showcase approval process: ${err}`) // Not logging more here as more detailed logs will come from downstream
        return await safeSendMessage(channel, '⚠️ Showcase approval process failed. (Internal error)')
      }
    }
  }
}
