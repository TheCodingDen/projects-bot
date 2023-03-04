import { ButtonInteraction } from 'discord.js'
import { interactionLog } from '../communication/interaction'
import { internalLog } from '../communication/internal'
import { fetchSubmissionByMessageId } from '../db/submission'
import { removeVote } from '../db/vote'
import { isValidated } from '../types/submission'
import { Vote, VoteType } from '../types/vote'
import { createEmbed, updateMessage } from '../utils/embed'
import { stringify } from '../utils/stringify'
import { canVote, toVoteRole } from '../utils/vote'
import {
  downvote,
  pause,
  unpause,
  upvote
} from './action'
import { VoteModificationResult } from './result'

export async function handleButtonEvent (
  event: ButtonInteraction<'cached'>
): Promise<void> {
  const { member, channel, message, customId } = event
  logger.debug(
    `Starting button event for ${stringify.user(
      member.user
    )} in ${stringify.channel(channel)} with type ${customId}`
  )

  const submission = await fetchSubmissionByMessageId(message.id)
  const rawType = customId

  if (!submission) {
    internalLog.error({
      type: 'text',
      content: `Could not locate submission for message id ${message.id}`,
      ctx: undefined
    })
    interactionLog.error({
      type: 'text',
      content: 'Failed to locate submission message, please report this.',
      ctx: event
    })
    return
  }

  if (!canVote(member)) {
    interactionLog.warning({
      type: 'text',
      content: 'You are not staff or veteran, so you cannot vote.',
      ctx: event
    })
    return
  }

  // Users cannot vote on pending or paused submissions
  if (!isValidated(submission)) {
    logger.debug(`Rejecting button as state is ${submission.state}`)
    interactionLog.warning({
      type: 'text',
      content:
        'Sorry, that submission is not in a valid state. To attempt revalidation, have a staff member run /revalidate',
      ctx: event
    })
    return
  }

  // If the submission is paused and we arent attempting to unpause reject the vote
  if (rawType !== 'pause' && submission.state === 'PAUSED') {
    logger.debug(
      `Rejecting button as state is PAUSED and rawType is ${rawType}`
    )
    interactionLog.error({
      type: 'text',
      content:
        'Could not action your vote because this submission is paused for voting at this time.',
      ctx: event
    })
    return
  }

  let type: VoteType = 'PAUSE'

  // Convert to DB vote type
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

  if (vote.role !== 'STAFF' && (vote.type === 'PAUSE' || vote.type === 'UNPAUSE')) {
    logger.info(`Preventing non staff member ${stringify.user(vote.voter.user)} from ${vote.type}ing`)
    interactionLog.warning({
      type: 'text',
      content: 'Only staff members are permitted to pause and unpause submissions.',
      ctx: event
    })

    return
  }

  logger.debug(`Working with vote ${stringify.vote(vote)}`)

  // This won't interfere with unpausing because we dont store pause votes
  const existingVote = submission.votes.find(
    (v) => v.role === vote.role && v.voter.id === vote.voter.id
  )

  // You have a vote but you arent trying to pause or unpause
  if (existingVote && type !== 'PAUSE' && type !== 'UNPAUSE') {
    if (existingVote.type !== type) {
      // Attempted to add an unrelated vote whilst already having one
      interactionLog.warning({
        type: 'text',
        content: 'You cannot add an upvote and a downvote.',
        ctx: event
      })
      return
    }

    logger.debug(`Removing existing vote ${stringify.vote(existingVote)}`)

    // Filter out the existing vote
    const filtered = submission.votes.filter((v) => v !== existingVote)

    submission.votes = filtered

    await removeVote(vote, submission)
    await updateMessage(submission.submissionMessage, createEmbed(submission))

    interactionLog.info({
      type: 'text',
      content: `Removed ${existingVote.type.toLowerCase()}.`,
      ctx: event
    })
    return
  }

  // If this vote rejects a project, ensure a draft rejection reason is set.
  const hasDraft = submission.drafts[0] !== undefined

  if (
    type === 'DOWNVOTE' &&
    !hasDraft
  ) {
    interactionLog.error({
      type: 'text',
      content: 'Cannot downvote without a draft set',
      ctx: event
    })
    return
  }

  let voteRes: VoteModificationResult

  // Defer because the actions could take some time
  await event.deferReply({
    ephemeral: true
  })

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
    interactionLog.error({
      type: 'text',
      content: 'Failed to cast vote, internal error occured',
      ctx: event
    })
    logger.error(voteRes.message)
    return
  }

  const outcome = voteRes.outcome

  if (outcome === 'vote-add') {
    interactionLog.info({
      type: 'text',
      content: `Applied ${vote.type.toLowerCase()}.`,
      ctx: event
    })
  } else if (outcome === 'reject') {
    interactionLog.info({
      type: 'text',
      content: 'Rejected the submission.',
      ctx: event
    })
  } else if (outcome === 'accept') {
    interactionLog.info({
      type: 'text',
      content: 'Accepted the submission.',
      ctx: event
    })
  } else if (outcome === 'pause') {
    interactionLog.info({
      type: 'text',
      content: 'Paused the submission for voting.',
      ctx: event
    })
  } else if (outcome === 'unpause') {
    interactionLog.info({
      type: 'text',
      content: 'Unpaused the submission for voting.',
      ctx: event
    })
  }
}
