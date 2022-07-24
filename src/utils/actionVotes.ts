import { VoteType } from '@prisma/client'
import { Message, ThreadChannel, User } from 'discord.js'
import { Err, Ok, Result } from 'ts-results'
import { ProjectsClient } from '../client'
import { SubmissionVotes } from '../models/schema/submission'
import { Submission } from '../models/submission'
import { Vote, VoteModificationResult } from '../models/vote'
import { assert } from './assert'
import { embeds } from './embeds'
import { log } from './logger'

interface VoteSituation {
  up: {
    staff: { votes: Vote[], count: number }
    veterans: { votes: Vote[], count: number }
  }
  down: {
    staff: { votes: Vote[], count: number }
    veterans: { votes: Vote[], count: number }
  }
}

interface LogParameters { project: Submission, author: User, voter: User, votes: VoteSituation, instantRejectionReason?: string}

// There may appear to be spaces here, but there isn't
const logEmojis = {
  redCross: '❌',
  greenTick: '✅',
  pause: '⏸️',
  play: '▶️'
} as const

const logMessages = {
  reject: ({ project, author, voter, votes }: LogParameters) =>
`${logEmojis.redCross} Project **${project.name}**
${formatProjectInformation(project, author)}

Was __**REJECTED**__ by **${voter.tag}** with the following vote situation:
${formatVoteSituation(votes)}
`,
  instareject: ({ project, author, voter, instantRejectionReason }: LogParameters) =>
`${logEmojis.redCross} Project **${project.name}**
${formatProjectInformation(project, author)}
Was __**FORCE REJECTED**__ by **${voter.tag}** for reason \`${instantRejectionReason}\`
`,

  approve: ({ project, author, voter, votes }: LogParameters) =>
`${logEmojis.greenTick} Project **${project.name}**
${formatProjectInformation(project, author)}
Was __**APPROVED**__ by **${voter.tag}** with the following vote situation:
${formatVoteSituation(votes)}
`,

  suspend: ({ project, voter }: LogParameters) => `
${logEmojis.pause} Voting on project **${project.name}** was __**SUSPENDED**__ by **${voter.tag}**. 
`,

  unsuspend: ({ project, voter }: LogParameters) => `
${logEmojis.pause} Voting on project **${project.name}** was __**UNSUSPENDED**__ by **${voter.tag}**. 
`

} as const

export async function instantlyReject (
  submission: Submission,
  voter: User,
  reason: string,
  client: ProjectsClient,
  shouldRunCleanup: boolean = true
): Promise<VoteModificationResult> {
  log.info(`Instantly rejecting ${submission} for reason ${reason}`)

  // Send log
  const msg = logMessages.instareject({
    project: submission,
    author: submission.author,
    voter,
    votes: generateVoteSituation(submission.votes),
    instantRejectionReason: reason
  })

  // Don't relate this, we don't want it getting cleared
  await client.communication.sendToLogChannel(msg, { name: submission.name, shouldRelate: false })

  // Clean up
  if (shouldRunCleanup) {
    await submissionCleanup(submission, client, 'denied')
  }

  // Set state
  submission.setRejected()

  // We don't send feedback here because the command handles it
  // as it varies from the regular feedback flow

  return { outcome: 'ok', reason: '' }
}

export async function reject (submission: Submission, vote: Vote, client: ProjectsClient, shouldRunCleanup: boolean = true): Promise<VoteModificationResult> {
  log.info(`Rejecting project ${submission}`)

  assertVoteType(vote, 'DOWN')

  const hasEnoughDownvotes = vote.rejectsProject(submission)

  if (!hasEnoughDownvotes) {
    throw new Error('Attempted to reject project without enough votes.')
  }

  if (submission.drafts.currentDraft() === undefined) {
    // Remove the vote; reverting to the original state upon error.
    await client.votes.downvote(submission, vote.voter, 'remove')

    return { outcome: 'error', reason: 'Cannot reject a project with no rejection message drafted. Please draft a message and try again.' }
  }

  // Send log
  const msg = logMessages.reject({
    project: submission,
    author: submission.author,
    voter: vote.voter.user,
    votes: generateVoteSituation(submission.votes)
  })

  // Don't relate this, we dont want it getting cleared
  await client.communication.sendToLogChannel(msg, { name: submission.name, shouldRelate: false })

  // Set state
  submission.setRejected()

  // Persist data
  await client.submissions.update(submission)

  // Send feedback
  const feedbackRes = await handleRejectionFeedback(submission, vote, client)

  if (feedbackRes.err) {
    return { outcome: 'error', reason: JSON.stringify(feedbackRes.val) }
  }

  // Clean up
  if (shouldRunCleanup) {
    await submissionCleanup(submission, client, 'denied')
  }

  return { outcome: 'ok', reason: '' }
}

export async function approve (submission: Submission, vote: Vote, client: ProjectsClient, shouldRunCleanup: boolean = true): Promise<VoteModificationResult> {
  log.info(`Approving project ${submission}`)

  assertVoteType(vote, 'UP')

  const hasEnoughUpvotes = vote.approvesProject(submission)

  if (!hasEnoughUpvotes) {
    throw new Error('Attempted to approve project without enough votes.')
  }

  const successEmbed = embeds.publicShowcase(submission)
  const { publicShowcase } = client.config.channels()

  const messageRes = await Result.wrapAsync(async () => await publicShowcase.send({ embeds: [successEmbed] }))

  if (messageRes.err) {
    log.error(`Failed to send message to public showcase for submission ${submission}`)
    log.error(messageRes.val)

    // Remove the vote; reverting to the original state upon error.
    await client.votes.upvote(submission, vote.voter, 'remove')

    // Early return, cease processing so they can retry
    return { outcome: 'error', reason: 'Failed to send message to public showcase due to Discord API error, please retry.' }
  }

  // Send log
  const msg = logMessages.approve({
    project: submission,
    author: submission.author,
    voter: vote.voter.user,
    votes: generateVoteSituation(submission.votes)
  })

  // Don't relate this, we dont want it getting cleared
  await client.communication.sendToLogChannel(msg, { name: submission.name, shouldRelate: false })

  // Clean up
  if (shouldRunCleanup) {
    await submissionCleanup(submission, client, 'denied')
  }

  // Set state
  submission.setApproved()

  // Persist data
  await client.submissions.update(submission)

  return { outcome: 'ok', reason: '' }
}

export async function suspend (submission: Submission, vote: Vote, client: ProjectsClient): Promise<VoteModificationResult> {
  log.info(`Suspending project ${submission}`)

  assertVoteType(vote, 'PAUSE')
  const pauseResult = await client.votes.changeSuspensionState(submission, vote.voter, 'suspend')

  if (pauseResult.outcome === 'error') {
    log.error(`Failed to suspend voting on project ${submission.name}`)

    // Return to the caller for further handling
    return pauseResult
  }

  // Send log
  const msg = logMessages.suspend({
    project: submission,
    author: submission.author,
    voter: vote.voter.user,
    votes: generateVoteSituation(submission.votes)
  })

  // Don't relate this, we don't want it getting cleared
  await client.communication.sendToLogChannel(msg, { name: submission.name, shouldRelate: false })

  log.info(`Suspended voting for project ${submission.name}`)

  return { outcome: 'ok', reason: '' }
}

export async function unsuspend (submission: Submission, vote: Vote, client: ProjectsClient): Promise<VoteModificationResult> {
  log.info(`Unsuspending project ${submission}`)

  assertVoteType(vote, 'PAUSE')

  const pauseResult = await client.votes.changeSuspensionState(submission, vote.voter, 'unsuspend')

  if (pauseResult.outcome === 'error') {
    // Return to the caller for further handling
    return pauseResult
  }

  // Send log
  const msg = logMessages.unsuspend({
    project: submission,
    author: submission.author,
    voter: vote.voter.user,
    votes: generateVoteSituation(submission.votes)
  })

  // Don't relate this, we dont want it getting cleared
  await client.communication.sendToLogChannel(msg, { name: submission.name, shouldRelate: false })

  log.info(`Unsuspended voting for project ${submission.name}`)

  return { outcome: 'ok', reason: '' }
}

export async function submissionCleanup (submission: Submission, client: ProjectsClient, action: 'accepted' | 'denied' | 'cleanup'): Promise<void> {
  const { privateSubmission } = client.config.channels()

  const deleteRes = await Result.wrapAsync(async () => await submission.message.delete())

  if (deleteRes.err) {
    log.error(`Could not delete submission post for ${submission.name} (${submission.id})`)
    log.error(deleteRes.val)

    void client.communication.reportWarning(`Could not delete project submission post. Please delete message ${submission.message.url} manually. (Discord error)`, submission)
  }

  const bulkRes = await Result.wrapAsync(async () => {
    log.debug(`Bulk deleting ${JSON.stringify(submission.relatedMessages)} for submission ${submission}`)

    return await privateSubmission.bulkDelete(submission.relatedMessages.map(m => m.messageId))
  })

  if (bulkRes.err) {
    log.error(`Failed to delete messages related to ${submission})`)
    log.error(bulkRes.val)

    void client.communication.reportWarning('Could not remove related messages, Discord returned an error', submission)
  }

  const threadId = submission.data.details.reviewThreadId
  const threadRes = await Result.wrapAsync(async () => {
    const thread = await privateSubmission.threads.fetch(threadId)

    if (!thread) {
      throw new Error(`Failed to fetch thread with ID ${threadId}`)
    }

    return await thread.setArchived(true, `Project ${submission.name} has been ${action}`)
  })

  if (threadRes.err) {
    log.error(`Failed to archive private review thread for submission ${submission}`)
    log.error(threadRes.val)

    void client.communication.reportError(`Could not archive review thread <#${threadId}> due to Discord API error.`, submission)
  }
}

async function handleRejectionFeedback (submission: Submission, actioningVote: Vote, client: ProjectsClient): Promise<Result<void, Error>> {
  const { publicFeedback, privateSubmission } = client.config.channels()
  const finalDraft = submission.drafts.currentDraft()

  const privateReviewThreadRes = await Result.wrapAsync<ThreadChannel | null, Error>(
    async () => await privateSubmission.threads.fetch(submission.data.details.reviewThreadId)
  )

  if (privateReviewThreadRes.err) {
    return Err(privateReviewThreadRes.val)
  }

  const privateReviewThread = privateReviewThreadRes.val

  if (!privateReviewThread) {
    return Err(new Error(`Could not fetch review thread with ID ${submission.data.details.reviewThreadId} for submission ${submission}`))
  }

  const getReviewerString = (): string => {
    const values = [...privateReviewThread.members.cache.values()]

    if (values.length === 0) {
      return ''
    }

    // Don't include the actioning voter, they're already here. Also don't include the bots
    const members = values
      .filter(m => m.id !== actioningVote.voter.id && !m.user?.bot)
      .map(m => `<@${m.id}>`)
      .join(' ')

    return `CC: ${members}`
  }

  // Callers should already have checked this
  assert(finalDraft !== undefined, 'no draft was set')

  const rejectionMessage =
`<@${actioningVote.voter.id}>, please send the message belown to this thread:

\`\`\`
${finalDraft.content}

${getReviewerString()}
\`\`\`
`

  const publicReviewThreadRes = await Result.wrapAsync<ThreadChannel, Error>(async () => await publicFeedback.threads.create({
    name: submission.name,
    type: client.config.botSettings().threadPrivacy
  }))

  if (publicReviewThreadRes.err) {
    return Err(publicReviewThreadRes.val)
  }

  const publicReviewThread = publicReviewThreadRes.val

  // Not using a safe send function because we want to ping
  const messageRes = await Result.wrapAsync<Message, Error>(async () => await publicReviewThread.send({
    content: rejectionMessage
  }))

  if (messageRes.err) {
    return Err(messageRes.val)
  }

  const sentMessage = messageRes.val

  const filter = (m: Message): boolean => m.author.id === actioningVote.voter.id && m.channelId === publicReviewThread.id

  // We don't care about the message itself, just that the feedback has been posted
  await publicReviewThread.awaitMessages({ filter, max: 1 })

  // Delete our message
  await sentMessage.delete()

  await privateReviewThread.send({
    content: `Feedback submitted, review thread: <#${publicReviewThread.id}>`
  })

  return Ok.EMPTY
}

function assertVoteType (vote: Vote, type: VoteType): void {
  assert(vote.type === type, `expected vote of type ${type}, got ${vote.type}`)
}

function formatVoteSituation (votes: VoteSituation): string {
  return `
**Staff:** ${votes.up.staff.count} UP | ${votes.down.staff.count} DOWN
**Veterans:** ${votes.up.veterans.count} UP | ${votes.down.veterans.count} DOWN
`
}

function formatProjectInformation (project: Submission, author: User): string {
  return `
Source: <${project.links.source}>
ProjectId: ${project.id}

**Author:**
    ID:     ${author.id}
    Mention: <@${author.id}>
    Tag:     ${author.tag}
`
}

function generateVoteSituation (votes: SubmissionVotes): VoteSituation {
  return {
    up: {
      staff: { votes: votes.upvotes.staff, count: votes.upvotes.staff.length },
      veterans: { votes: votes.upvotes.veterans, count: votes.upvotes.veterans.length }
    },
    down: {
      staff: { votes: votes.downvotes.staff, count: votes.downvotes.staff.length },
      veterans: { votes: votes.downvotes.veterans, count: votes.downvotes.veterans.length }
    }
  }
}
