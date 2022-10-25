import { ButtonInteraction } from 'discord.js'
import { interactionLog } from '../communication/interaction'
import { internalLog } from '../communication/internal'
import { fetchSubmissionByMessageId } from '../db/submission'
import { removeVote } from '../db/vote'
import { Vote, VoteType } from '../types/vote'
import { createEmbed, updateMessage } from '../utils/embed'
import { stringify } from '../utils/stringify'
import { canVote, toVoteRole } from '../utils/vote'
import { downvote, pause, unpause, upvote } from './action'
import { VoteModificationResult } from './result'

export async function handleButtonEvent (
  event: ButtonInteraction<'cached'>
): Promise<void> {
  const { member, channel, message, customId } = event
  logger.debug(`Starting button event for ${stringify.user(member.user)} in ${stringify.channel(channel)} with type ${customId}`)

  const submission = await fetchSubmissionByMessageId(message.id)
  const rawType = customId

  if (!submission) {
    internalLog.error(
      `Could not locate submission for message id ${message.id}`,
      undefined
    )
    return
  }

  if (!canVote(member)) {
    interactionLog.warning('You are not staff or veteran, so you cannot vote.', event)
    return
  }

  // Check the pending case, abort if it is in the pending state
  if (!(submission.state === 'PROCESSING' || submission.state === 'PAUSED')) {
    logger.debug(`Rejecting button as state is ${submission.state}`)
    interactionLog.warning(
      'Sorry, that submission is not available for voting at this time.',
      event
    )
    return
  }

  // If the submission is paused and we arent attempting to unpause reject the vote
  if (rawType !== 'pause' && submission.state === 'PAUSED') {
    logger.debug(`Rejecting button as state is PAUSED and rawType is ${rawType}`)
    interactionLog.error(
      'Could not action your vote because this submission is paused for voting at this time.',
      event
    )
    return
  }

  let type: VoteType = 'PAUSE'

  if (rawType === 'upvote') {
    type = 'UPVOTE'
  } else if (rawType === 'downvote') {
    type = 'DOWNVOTE'
  } else if (rawType === 'pause' && submission.state === 'PAUSED') {
    type = 'UNPAUSE'
  } else {
    type = 'PAUSE'
  }

  const vote: Vote = {
    voter: member,
    type,
    role: toVoteRole(member)
  }

  logger.debug(`Working with vote ${stringify.vote(vote)}`)

  // This won't interfere with unpausing because we dont store pause votes
  const existingVote = submission.votes.find(
    (v) =>
      v.role === vote.role &&
      v.voter.id === vote.voter.id
  )

  if (existingVote) {
    if (existingVote.type !== type) {
      // Attempted to add an unrelated vote whilst already having one
      interactionLog.warning('You cannot add an upvote and a downvote.', event)
      return
    }

    logger.debug(`Removing existing vote ${stringify.vote(existingVote)}`)

    // Filter out this vote
    const filtered = submission.votes.filter((v) => v !== existingVote)

    submission.votes = filtered

    await removeVote(vote, submission)
    await updateMessage(submission.submissionMessage, createEmbed(submission))

    interactionLog.info(`Removed ${existingVote.type.toLowerCase()}.`, event)
    return
  }

  let voteRes: VoteModificationResult

  switch (type) {
    case 'UPVOTE':
      voteRes = await upvote(vote, submission)
      break
    case 'DOWNVOTE':
      voteRes = await downvote(vote, submission)
      break
    case 'PAUSE':
      voteRes = await pause(vote, submission)
      break
    case 'UNPAUSE':
      voteRes = await unpause(vote, submission)
      break
  }

  if (voteRes.error) {
    interactionLog.error('Failed to cast vote, internal error occured', event)
    return
  }

  // Only log if the interaction will still exist
  const outcome = voteRes.outcome
  if (outcome === 'vote-add') {
    interactionLog.info(`Applied ${vote.type.toLowerCase()}`, event)
  } else if (outcome === 'pause') {
    interactionLog.info('Paused the submission for voting.', event)
  } else if (outcome === 'unpause') {
    interactionLog.info('Unpaused the submission for voting.', event)
  }
}
