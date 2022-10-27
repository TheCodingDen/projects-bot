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
  await updateSubmissionState(submission, 'PAUSED')
  await updateMessage(submission.submissionMessage, createEmbed(submission))

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
  await updateSubmissionState(submission, 'PROCESSING')
  await updateMessage(submission.submissionMessage, createEmbed(submission))

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

  await addVote(vote, submission)
  submission.votes.push(vote)

  await submission.reviewThread.setArchived(true)

  await submission.submissionMessage.delete()

  const completedSubmission: CompletedSubmission = {
    ...submission,
    state: 'ACCEPTED'
  }

  const { publicShowcase } = config.channels()
  const embed = createEmbed(completedSubmission)

  await publicShowcase.send({
    embeds: [embed]
  })

  // Report any errors in logs
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
  const draft = submission.drafts[0]
  assert(!!draft, 'cannot reject without a draft')

  const reviewers = await submission.reviewThread.members.fetch()
  const formattedReviewers = reviewers.filter(v => !v.user?.bot).map(v => `<@${v.id}>`)

  const rejectionMessage = `
Reviewers: ${formattedReviewers}

Send the message below in this thread:
\`\`\`
${draft.content}
\`\`\`
`

  await addVote(vote, submission)
  submission.votes.push(vote)

  // TODO: extract this into a helper function
  const { publicShowcase } = config.channels()
  const feedbackThread = await publicShowcase.threads.create({
    name: submission.name,
    // This cannot be abstracted anywhere because we need to keep the union around
    type:
      process.env.NODE_ENV === 'production'
        ? ChannelType.PrivateThread
        : ChannelType.PublicThread
  })

  const sentMessage = await feedbackThread.send({
    content: rejectionMessage
  })

  const filter = (m: Message): boolean =>
    reviewers.has(m.author.id) && m.channelId === feedbackThread.id

  await feedbackThread.awaitMessages({ filter, max: 1 })

  await sentMessage.delete()

  await submission.reviewThread.setArchived(true)

  await submission.submissionMessage.delete()

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

export function voteAcceptsProject (
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

export function voteRejectsProject (
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
