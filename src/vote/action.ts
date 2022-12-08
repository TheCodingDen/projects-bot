import assert from 'assert'
import { EmbedField, GuildMember, Message } from 'discord.js'
import { client } from '..'
import { privateLog } from '../communication/private'
import config from '../config'
import {
  updateSubmissionState,
  validatePendingSubmission
} from '../db/submission'
import { addVote } from '../db/vote'
import {
  CompletedSubmission,
  isPending,
  isValidated,
  PendingSubmission,
  ValidatedSubmission
} from '../types/submission'
import { Vote } from '../types/vote'
import { createEmbed, updateMessage } from '../utils/embed'
import { runCatching } from '../utils/request'
import { sendMessageToFeedbackThread } from '../utils/thread'
import { VoteModificationResult } from './result'

/**
 * Apply an upvote to a submission.
 */
export async function upvote (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'UPVOTE', `expected UPVOTE got ${vote.type}`)

  if (voteAcceptsSubmission(vote, submission)) {
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

/**
 * Apply a downvote to a submission.
 */
export async function downvote (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'DOWNVOTE', `expected DOWNVOTE got ${vote.type}`)

  if (voteRejectsSubmission(vote, submission)) {
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

/**
 * Pause a submission for voting.
 */
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

  privateLog.info({
    type: 'embed',
    embed: {
      title: submission.name,
      description: `**${vote.voter.user.tag}** **__PAUSED__** the submission for voting.`,
      fields: [
        {
          name: 'ID',
          value: submission.id
        },
        {
          name: 'Source',
          value: submission.links.source
        },
        {
          name: 'Author',
          value: `<@${submission.authorId}> (${submission.authorId})`
        }
      ],
      color: config.colours().log.pause
    },
    ctx: submission
  })

  return {
    error: false,
    outcome: 'pause'
  }
}

/**
 * Unpause a submission for voting.
 */
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

  privateLog.info({
    type: 'embed',
    embed: {
      title: submission.name,
      description: `**${vote.voter.user.tag}** **__UNPAUSED__** the submission for voting.`,
      fields: [
        {
          name: 'ID',
          value: submission.id
        },
        {
          name: 'Source',
          value: submission.links.source
        },
        {
          name: 'Author',
          value: `<@${submission.author.id}> (${submission.author.user.tag}, ${submission.author.id})`
        }
      ],
      color: config.colours().log.pause
    },
    ctx: submission
  })

  return {
    error: false,
    outcome: 'unpause'
  }
}

/**
 * Accept a submission, this will run cleanup for the submission.
 */
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

  privateLog.info({
    type: 'embed',
    embed: {
      title: submission.name,
      description: `**${vote.voter.user.tag}** **__ACCEPTED__** the submission.`,
      fields: [
        {
          name: 'ID',
          value: submission.id
        },
        {
          name: 'Source',
          value: submission.links.source
        },
        {
          name: 'Author',
          value: `<@${submission.author.id}> (${submission.author.user.tag}, ${submission.author.id})`
        },
        ...generateVoteFields(submission.votes)
      ],
      color: config.colours().log.accepted
    },
    ctx: submission
  })

  await updateSubmissionState(submission, 'ACCEPTED')

  return {
    error: false,
    outcome: 'accept'
  }
}

/**
 * Reject a submission, this will run cleanup for the submission.
 */
export async function reject (
  vote: Vote,
  submission: ValidatedSubmission
): Promise<VoteModificationResult> {
  assert(vote.type === 'DOWNVOTE', `expected DOWNVOTE got ${vote.type}`)
  const draft = submission.drafts[0]
  assert(!!draft, 'cannot reject without a draft')

  await addVote(vote, submission)
  submission.votes.push(vote)

  await updateMessage(submission.submissionMessage, createEmbed(submission))

  const threadMembers = await Promise.all(
    // Re-fetch *all* the users because for some idiotic reason, "members.fetch"
    // does not actually fetch members..? "member.user" becomes nullable which would
    // cause the check to erroneously fail in some cases where the user wasnt cached.
    (
      await submission.reviewThread.members.fetch()
    ).map(async (v) => await client.users.fetch(v.id))
  )

  const voters = submission.votes.map((v) => v.voter.user)

  // Converting to a Set removes duplicates. It's the easiest way to do this in JS.
  const reviewers = [...new Set([...threadMembers, ...voters])]

  const formattedReviewers = reviewers
    .filter((v) => !v.bot)
    .map((v) => `<@${v.id}>`)

  const rejectionMessage = `
Reviewers: ${formattedReviewers}

Send the message below in this thread:
\`\`\`
${draft.content}
\`\`\`
`

  const { message: sentMessage, thread: feedbackThread } =
    await sendMessageToFeedbackThread(
      {
        content: rejectionMessage
      },
      submission
    )

  await updateSubmissionState(submission, 'DENIED')

  const filter = (m: Message): boolean => m.channelId === feedbackThread.id

  await feedbackThread.awaitMessages({ filter, max: 1 })

  await sentMessage.delete()

  await submission.reviewThread.setArchived(true)

  await submission.submissionMessage.delete()

  privateLog.info({
    type: 'embed',
    embed: {
      title: submission.name,
      description: `**${vote.voter.user.tag}** **__REJECTED__** the submission.`,
      fields: [
        {
          name: 'ID',
          value: submission.id
        },
        {
          name: 'Source',
          value: submission.links.source
        },
        {
          name: 'Author',
          value: `<@${submission.author.id}> (${submission.author.user.tag}, ${submission.author.id})`
        },
        ...generateVoteFields(submission.votes)
      ],
      color: config.colours().log.denied
    },
    ctx: submission
  })

  return {
    error: false,
    outcome: 'reject'
  }
}

interface RejectionDetails {
  templatedReason: string
  rawReason: string
}

/**
 * Forcefully reject a submission, this will run cleanup for the submission.
 */
export async function forceReject (
  voter: GuildMember,
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

  try {
    if (config.rejection().publiclyLogged.includes(details.rawReason)) {
      // We want to publicly log it

      const { publicLogs } = config.channels()
      await runCatching(async () => await publicLogs.send({
        content: details.templatedReason
      }), 'suppress')
    } else {
      await sendMessageToFeedbackThread(
        {
          content: details.templatedReason
        },
        submission
      )
    }
  } catch (err) {
    return {
      error: true,
      message: `Failed to send rejection message: ${err}`
    }
  }

  privateLog.info({
    type: 'embed',
    embed: {
      title: submission.name,
      description: `**${voter.user.tag}** **__FORCE-REJECTED__** the submission.`,
      fields: [
        {
          name: 'ID',
          value: submission.id
        },
        {
          name: 'Source',
          value: submission.links.source
        },
        {
          name: 'Author',
          value: `<@${submission.authorId}> (${submission.authorId})`
        }
      ],
      color: config.colours().log.denied
    },
    ctx: submission
  })

  if (isValidated(submission)) {
    // We can supress these, they arent critical for operation
    await runCatching(async () => {
      await submission.reviewThread.setArchived(true)
      await submission.submissionMessage.delete()
    }, 'suppress')

    return {
      error: false,
      outcome: 'instant-reject'
    }
  }

  if (isPending(submission)) {
    // Validate to get the objects we need to run cleanup
    const { reviewThread, submissionMessage } = await validatePendingSubmission(
      submission
    )

    // We can supress these, they arent critical for operation
    await runCatching(async () => {
      await reviewThread.setArchived(true)
      await submissionMessage.delete()
    }, 'suppress')

    return {
      error: false,
      outcome: 'instant-reject'
    }
  }

  assert(false, 'unreachable')
}

/**
 * Determine whether an upvote will accept a submission, this means
 * the total votes including this one surpases the voting threshold as
 * defined in the config.
 */
export function voteAcceptsSubmission (
  vote: Vote,
  submission: ValidatedSubmission
): boolean {
  assert(vote.type === 'UPVOTE', `expected UPVOTE, got ${vote.type}`)
  // Get all upvotes
  const votes = submission.votes.filter((v) => v.type === 'UPVOTE').length

  const { threshold } = config.vote()
  return votes + 1 >= threshold
}

/**
 * Determine whether an upvote will reject a submission, this means
 * the total votes including this one surpases the voting threshold as
 * defined in the config.
 */
export function voteRejectsSubmission (
  vote: Vote,
  submission: ValidatedSubmission
): boolean {
  assert(vote.type === 'DOWNVOTE', `expected DOWNVOTE, got ${vote.type}`)
  // Get all downvotes
  const votes = submission.votes.filter((v) => v.type === 'DOWNVOTE').length

  const { threshold } = config.vote()
  return votes + 1 >= threshold
}

function generateVoteFields (votes: Vote[]): [EmbedField, EmbedField] {
  const upvotes = votes.filter((v) => v.type === 'UPVOTE')
  const downvotes = votes.filter((v) => v.type === 'DOWNVOTE')

  const upvoteString =
    upvotes.map((v) => `${v.voter.user.tag}`).join('\n') || 'None'
  const downvoteString =
    downvotes.map((v) => `${v.voter.user.tag}`).join('\n') || 'None'

  return [
    {
      name: `Upvotes (${upvotes.length})`,
      value: upvoteString,
      inline: true
    },
    {
      name: `Downvotes (${downvotes.length})`,
      value: downvoteString,
      inline: true
    }
  ]
}