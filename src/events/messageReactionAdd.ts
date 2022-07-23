import Discord from 'discord.js'
import * as reactionPrereqs from '../utils/reactionPrereqs'
import { log } from '../utils/logger'
import { ProjectsClient } from '../client'
import { Vote } from '../models/vote'
import { processVote } from '../utils/processVote'
import { botRemovedReactions } from './messageReactionRemove'
import { Err, Ok, Result } from 'ts-results'

export default async (client: ProjectsClient, reaction: Discord.MessageReaction, user: Discord.User): Promise<Result<void, Error>> => {
  // Ensure reaction was not added in DM, even though the ID check would already technically speaking prevent this
  if (!reaction.message.guild) {
    return Ok.EMPTY
  }

  const { id: messageId, channel, guild } = reaction.message
  const { emoji } = reaction

  // Check that preflights pass
  if (!reactionPrereqs.allPass(client, user, channel, reaction)) {
    log.debug('Rejecting messageReactionAdd due to pre-req fail')
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

  // Only reject the vote if the submission is paused. Any reaction (addition) here is not OK.
  if (project.isPaused()) {
    botRemovedReactions.add(user.id)
    void await reaction.users.remove(user.id)
    await client.communication.reportWarning(`<@${user.id}>: Your vote could not be registered because '${project.name}' is paused for voting at this time.`, project)

    return Ok.EMPTY
  }

  // Get reacting member
  const memberRes = await Result.wrapAsync(async () => await guild.members.fetch(user.id))

  if (memberRes.err) {
    const err = memberRes.val

    log.error(`Could not fetch reacting member: ${err}`)
    await client.communication.reportWarning(`<@${user.id}>: Your vote was not possible to register due to identification failure. (Discord error)`, project)
    return Err(err as Error)
  }

  const member = memberRes.val

  let vote
  if (isUpvote) { // Upvote
    vote = new Vote(client, 'UP', 'add', member, project.id)
  } else if (isPause) { // Pause
    vote = new Vote(client, 'PAUSE', 'add', member, project.id)
  } else { // Downvote
    vote = new Vote(client, 'DOWN', 'add', member, project.id)
  }

  const voteRes = await processVote(project, vote, reaction, client)

  if (voteRes.err) {
    log.error('Error occurred unexpected error while processing project reaction')
    log.error(voteRes.val)
    await client.communication.reportError('Error occurred during reaction addition process.', project)

    return Err(voteRes.val)
  }

  return Ok.EMPTY
}
