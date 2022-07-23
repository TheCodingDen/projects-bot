import Discord, { Snowflake } from 'discord.js'
import * as reactionPrereqs from '../utils/reactionPrereqs'
import { log } from '../utils/logger'
import { ProjectsClient } from '../client'
import { Vote } from '../models/vote'
import { processVote } from '../utils/processVote'
import { Err, Ok, Result } from 'ts-results'

// This set holds the user IDs of users whose reaction got removed by the bot
// This stops invalid state where the bot attempts to process such events as actual vote removals
export const botRemovedReactions = new Set<Snowflake>()

export default async (client: ProjectsClient, reaction: Discord.MessageReaction, user: Discord.User): Promise<Result<void, Error>> => {
  // Ensure reaction was not added in DM, even though the ID check would already technically speaking prevent this
  if (!reaction.message.guild) {
    log.debug('Rejecting messageReactionRemove due to pre-req fail')
    return Ok.EMPTY
  }

  const { id: messageId, channel, guild } = reaction.message
  const { emoji } = reaction

  // Check that preflights pass
  if (!reactionPrereqs.allPass(client, user, channel, reaction)) {
    log.debug('Rejecting messageReactionRemove due to pre-req fail')
    return Ok.EMPTY
  }

  const idRes = await client.submissions.getIdForMessageId(messageId)

  if (idRes.err) {
    return Err(idRes.val)
  }

  const id = idRes.val

  const projectRes = await client.submissions.fetch(id)

  if (projectRes.err) {
    await client.communication.reportWarning(`<@${user.id}>: Could not register your vote. Could not find a project related to that message.`, { name: 'Unknown', shouldRelate: false })
    return Err(projectRes.val)
  }

  const project = projectRes.val
  const { upvote, pause } = client.config.emojis()

  // Don't need to check downvote separately, as that would be the only other condition here
  const isUpvote = emoji.id === upvote
  const isPause = emoji.id === pause

  // Get reacting member
  const memberRes = await Result.wrapAsync(async () => await guild.members.fetch(user.id))

  if (memberRes.err) {
    const err = memberRes.val

    log.error(`Could not fetch reacting member: ${err}`)
    await client.communication.reportWarning(`<@${user.id}>: Your vote was not possible to register due to identification failure. (Discord error)`, project)
    return Err(err as Error)
  }

  const member = memberRes.val

  if (botRemovedReactions.has(user.id)) {
    // This is a case where the bot removed the member's reaction because they did not have perms to pause
    // or they tried to vote whilst the project was paused

    // It's a hack because we still get remove events for reactions we remove from messages
    // At some point, we will have a better way of detecting and ignoring these
    log.debug(`Prevented handling of pause vote from user ${member.id} to stop invalid votes.`)

    botRemovedReactions.delete(user.id)
    return Ok.EMPTY
  }

  let vote
  if (isUpvote) { // Upvote
    vote = new Vote(client, 'UP', 'remove', member, project.id)
  } else if (isPause) { // Pause
    vote = new Vote(client, 'PAUSE', 'remove', member, project.id)
  } else { // Downvote
    vote = new Vote(client, 'DOWN', 'remove', member, project.id)
  }

  const voteRes = await processVote(project, vote, reaction, client)

  if (voteRes.err) {
    log.error('Error occurred unexpected error while processing project reaction')
    log.error(voteRes.val)
    await client.communication.reportError('Error occurred during reaction removal process.', project)

    return Err(voteRes.val)
  }

  return Ok.EMPTY
}
