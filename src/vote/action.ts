import assert from 'assert'
import { ChannelType, GuildMember, Message } from 'discord.js'
import { privateLog } from '../communication/private'
import config from '../config'
import {
  updateSubmissionState,
  validatePendingSubmission
} from '../db/submission'
import { addVote } from '../db/vote'
import {
  CompletedSubmission,
  PendingSubmission,
  ValidatedSubmission
} from '../types/submission'
import { Vote } from '../types/vote'
import { createEmbed, updateMessage } from '../utils/embed'
import { sendMessageToFeedbackThread } from '../utils/thread'
import { VoteModificationResult } from './result'

export async function upvote (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'UPVOTE', `expected UPVOTE got ${vote.type}`)

  if (voteAcceptsProject(vote, submission)) {
    return await accept(vote, submission)
  }

  await addVote(vote, submission)

  submission.votes.push(vote)

  await updateMessage(submission.submissionMessage, createEmbed(submission))

  return {
    error: false,
    outcome: 'vote-add'
  }
}

export async function downvote (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'DOWNVOTE', `expected DOWNVOTE got ${vote.type}`)

  if (voteRejectsProject(vote, submission)) {
    return await reject(vote, submission)
  }

  await addVote(vote, submission)

  submission.votes.push(vote)

  await updateMessage(submission.submissionMessage, createEmbed(submission))

  return {
    error: false,
    outcome: 'vote-add'
  }
}

export async function pause (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'PAUSE', `expected PAUSE got ${vote.type}`)
  assert(
    submission.state === 'PROCESSING',
    `expected PROCESSING got ${submission.state}`
  )

  submission.state = 'PAUSED'
  updateSubmissionState(submission, 'PAUSED')
  updateMessage(submission.submissionMessage, createEmbed(submission))

  privateLog.info(`<@${vote.voter.id}> paused the submission.`, submission)

  return {
    error: false,
    outcome: 'pause'
  }
}

export async function unpause (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'UNPAUSE', `expected UNPAUSE got ${vote.type}`)
  assert(
    submission.state === 'PAUSED',
    `expected PAUSED got ${submission.state}`
  )

  submission.state = 'PROCESSING'
  updateSubmissionState(submission, 'PROCESSING')
  updateMessage(submission.submissionMessage, createEmbed(submission))

  privateLog.info(`<@${vote.voter.id}> unpaused the submission.`, submission)

  return {
    error: false,
    outcome: 'unpause'
  }
}

export async function accept (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'UPVOTE', `expected UPVOTE got ${vote.type}`)

  // Step 1: Add vote to DB
  await addVote(vote, submission)
  submission.votes.push(vote)

  // Step 2: Archive the review thread
  await submission.reviewThread.setArchived(true)

  // Step 3: Delete submission message
  await submission.submissionMessage.delete()

  const completedSubmission: CompletedSubmission = {
    ...submission,
    state: 'ACCEPTED'
  }

  // Step 4: Post to public showcase
  const { publicShowcase } = config.channels()
  const embed = createEmbed(completedSubmission)

  await publicShowcase.send({
    embeds: [embed]
  })

  // Step 5: Report any errors in logs
  // TODO:

  privateLog.info(`<@${vote.voter.id}> accepted the submission.`, submission)

  return {
    error: false,
    outcome: 'accept'
  }
}

export async function reject (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'DOWNVOTE', `expected DOWNVOTE got ${vote.type}`)
  // Step 1: Get latest draft
  // TODO:
  const rejectionMessage = `Reject? <@${vote.voter.id}>`

  // Step 2: Save vote to DB
  await addVote(vote, submission)
  submission.votes.push(vote)

  // Step 3: Create private feedback thread
  const { publicShowcase } = config.channels()
  const feedbackThread = await publicShowcase.threads.create({
    name: submission.name,
    // This cannot be abstracted anywhere because we need to keep the union around
    type:
      process.env.NODE_ENV === 'production'
        ? ChannelType.PrivateThread
        : ChannelType.PublicThread
  })

  // Step 4: Send message template
  const sentMessage = await feedbackThread.send({
    content: rejectionMessage
  })

  // Step 5: Wait for user to send template
  const filter = (m: Message): boolean =>
    m.author.id === vote.voter.id && m.channelId === feedbackThread.id

  // We don't care about the message itself, just that the feedback has been posted
  await feedbackThread.awaitMessages({ filter, max: 1 })

  // Delete our message now
  await sentMessage.delete()

  // Step 6: Archive review thread
  await submission.reviewThread.setArchived(true)

  // Step 7: Delete submission message
  await submission.submissionMessage.delete()

  // Step 8: Log rejection in private logs
  privateLog.info(`<@${vote.voter.id}> rejected the submission.`, submission)

  return {
    error: false,
    outcome: 'reject'
  }
}

interface RejectionDetails {
  templatedReason: string
  rawReason: string
}

export async function forceReject (
  rejecter: GuildMember,
  // Could be in the pending state, we will just ignore warnings if that is the case
  submission: ValidatedSubmission | PendingSubmission,
  details: RejectionDetails
): Promise<VoteModificationResult> {
  // Do not allow errored or paused submissions to be rejected, this should be checked by the caller
  assert(
    submission.state !== 'ERROR',
    'attempted to force-reject an ERROR state submission'
  )
  assert(
    submission.state !== 'PAUSED',
    'attempted to force-reject an PAUSED state submission'
  )

  await sendMessageToFeedbackThread(
    {
      content: details.templatedReason
    },
    submission
  )

  privateLog.info(
    `<@${rejecter.id}> force-rejected the submission. (reason: ${details.rawReason})`,
    submission
  )

  if (submission.state === 'PROCESSING') {
    await submission.reviewThread.setArchived(true)
    await submission.submissionMessage.delete()

    return {
      error: false,
      outcome: 'instant-reject'
    }
  }

  if (submission.state === 'WARNING') {
    // Validate to get the objects we need to run cleanup
    const { reviewThread, submissionMessage } = await validatePendingSubmission(
      submission
    )

    await reviewThread.setArchived(true)
    await submissionMessage.delete()

    return {
      error: false,
      outcome: 'instant-reject'
    }
  }

  assert(false, 'unreachable')
}

function voteAcceptsProject (
  vote: Vote,
  submission: ValidatedSubmission
): boolean {
  assert(vote.type === 'UPVOTE', `expected UPVOTE, got ${vote.type}`)
  // Get all upvotes
  const votes = submission.votes
    .filter((v) => v.type === 'UPVOTE')
    .length

  const { threshold } = config.vote()
  return votes + 1 >= threshold
}

function voteRejectsProject (
  vote: Vote,
  submission: ValidatedSubmission
): boolean {
  assert(vote.type === 'DOWNVOTE', `expected DOWNVOTE, got ${vote.type}`)
  // Get all downvotes
  const votes = submission.votes
    .filter((v) => v.type === 'DOWNVOTE')
    .length

  const { threshold } = config.vote()
  return votes + 1 >= threshold
}
