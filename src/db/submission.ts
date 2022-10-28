import {
  Submission as PrismaSubmission,
  Vote as PrismaVote,
  Draft as PrismaDraft
} from '@prisma/client'
import assert from 'assert'
import { GuildMember, Message, Snowflake, ThreadChannel } from 'discord.js'
import config from '../config'
import { Draft } from '../types/draft'
import { SubmissionId } from '../types/misc'
import {
  ApiSubmission,
  PendingSubmission,
  SubmissionState,
  ValidatedSubmission
} from '../types/submission'
import { Vote } from '../types/vote'
import { runCatching } from '../utils/request'
import { stringify } from '../utils/stringify'
import { query } from './client'

export async function fetchSubmissionByThreadId (
  id: Snowflake
): Promise<ValidatedSubmission | PendingSubmission | undefined> {
  const data = await query((db) =>
    db.submission.findUnique({
      where: {
        reviewThreadId: id
      },
      include: {
        votes: true,
        drafts: true
      }
    })
  )

  logger.debug(`Starting search for submission by thread ID ${id}`)

  if (!data) {
    // No submission exists, report it in the logs for debugging
    logger.debug(`No submission existed for thread ID ${id}`)
    return undefined
  }

  if (data.state === 'ERROR' || data.state === 'WARNING') {
    // It's a pending submission
    const pending: PendingSubmission = {
      ...data,
      state: data.state,
      tech: data.techUsed,
      links: {
        source: data.sourceLinks,
        other: data.otherLinks
      }
    }

    logger.debug(`Got submission ${stringify.submission(pending)}`)

    return pending
  }

  return await resolvePrismaData(data)
}

export async function fetchSubmissionsByMemberId (
  id: Snowflake
): Promise<PendingSubmission[]> {
  const data = await query((db) =>
    db.submission.findMany({
      where: {
        authorId: id
      },
      include: {
        votes: true
      }
    })
  )

  logger.debug(`Starting search for submissions by author ID ${id}`)

  if (!data.length) {
    // No submission exists, log it for debugging
    logger.debug(`No submissions existed for author ID ${id}`)
    return []
  }

  const out: PendingSubmission[] = []

  for (const submission of data) {
    const pending: PendingSubmission = {
      ...submission,
      // It's going to be an error state anyways
      state: 'ERROR',
      tech: submission.techUsed,
      links: {
        source: submission.sourceLinks,
        other: submission.otherLinks
      }
    }

    logger.debug(`Got submission ${stringify.submission(pending)}`)

    out.push(pending)
  }

  return out
}

export async function fetchSubmissionByMessageId (
  id: Snowflake
): Promise<ValidatedSubmission | PendingSubmission | undefined> {
  const data = await query((db) =>
    db.submission.findUnique({
      where: {
        messageId: id
      },
      include: {
        votes: true,
        drafts: true
      }
    })
  )

  logger.debug(`Starting search for submission by message ID ${id}`)

  if (!data) {
    // No submission exists, log it for debugging
    logger.debug(`No submission existed for message ID ${id}`)
    return undefined
  }

  if (data.state === 'ERROR' || data.state === 'WARNING') {
    // It's a pending submission
    const pending: PendingSubmission = {
      ...data,
      state: data.state,
      tech: data.techUsed,
      links: {
        source: data.sourceLinks,
        other: data.otherLinks
      }
    }

    logger.debug(`Got submission ${stringify.submission(pending)}`)

    return pending
  }

  return await resolvePrismaData(data)
}

type PrismaData = PrismaSubmission & {
  votes: PrismaVote[]
  drafts: PrismaDraft[]
}

async function fetchAuthor (authorId: Snowflake): Promise<GuildMember> {
  logger.trace(`Fetching author by ID ${authorId}`)
  const guild = config.guilds().current
  return await runCatching(async () => await guild.members.fetch(authorId), 'rethrow')
}

async function fetchReviewThread (threadId: Snowflake): Promise<ThreadChannel> {
  logger.trace(`Fetching review thread by ID ${threadId}`)
  const { privateSubmissions } = config.channels()
  const reviewThread = await runCatching(
    async () => await privateSubmissions.threads.fetch(threadId),
    'rethrow'
  )

  // Review thread must exist. If not, we cannot continue.
  assert(!!reviewThread, 'review thread did not exist')

  return reviewThread
}

async function fetchFeedbackThread (
  threadId: Snowflake
): Promise<ThreadChannel | undefined> {
  logger.trace(`Fetching feedback thread by ID ${threadId}`)
  const { publicShowcase } = config.channels()
  const feedbackThread = await runCatching(
    async () => await publicShowcase.threads.fetch(threadId),
    'rethrow'
  )

  // Coerce null to undefined for consistency
  return feedbackThread ?? undefined
}

async function fetchVotes (prismaVotes: PrismaVote[]): Promise<Vote[]> {
  return await Promise.all(
    prismaVotes.map(async (v) => {
      logger.trace(
        `Fetching voter by ID on submission ${v.submissionId} ${v.voterId}`
      )
      const voter = await runCatching(
        async () => await config.guilds().current.members.fetch(v.voterId),
        'rethrow'
      )

      const vote = {
        type: v.type,
        voter,
        role: v.role
      }

      logger.debug(`Got vote ${stringify.vote(vote)}`)
      return vote
    })
  )
}

async function fetchDrafts (prismaDrafts: PrismaDraft[]): Promise<Draft[]> {
  return (
    await Promise.all(
      prismaDrafts.map(async (d) => {
        logger.trace(
          `Fetching draft author by ID on submission ${d.submissionId} ${d.authorId}`
        )

        const author = await runCatching(
          async () => await config.guilds().current.members.fetch(d.authorId),
          'rethrow'
        )

        const draft = {
          ...d,
          author
        }

        logger.debug(`Got draft ${stringify.draft(draft)}`)
        return draft
      })
    )
  )
  // Sort by newest first
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

async function fetchOriginalMessage (messageId: Snowflake): Promise<Message> {
  const { privateSubmissions } = config.channels()
  logger.trace(`Fetching original message by ID ${messageId}`)

  return await runCatching(
    async () => await privateSubmissions.messages.fetch(messageId),
    'rethrow'
  )
}

async function resolvePrismaData (
  data: PrismaData
): Promise<ValidatedSubmission> {
  logger.debug(`Beginning resolution of prisma data for submission ${data.id}`)

  logger.trace('Checking states')
  // These states are invalid for a ValidatedSubmission
  assert(data.state !== 'RAW', 'submission was in raw state')
  assert(data.state !== 'ACCEPTED', 'submission was in accepted state')
  assert(data.state !== 'DENIED', 'submission was in denied state')
  assert(data.state !== 'WARNING', 'submission was in warning state')
  assert(data.state !== 'ERROR', 'submission was in error state')
  logger.trace('States ok')

  logger.trace('Asserting required DB columns exist')
  // Assert the data required for a 'processing' or 'paused' state submission exists
  assert(!!data.reviewThreadId, 'review thread id did not exist')
  assert(!!data.messageId, 'message id did not exist')
  logger.trace('Data exists')

  logger.debug('Making API requests to fetch required data')
  // Fetch all required data to form a ValidatedSubmission
  const author = await fetchAuthor(data.authorId)
  const reviewThread = await fetchReviewThread(data.reviewThreadId)
  const submissionMessage = await fetchOriginalMessage(data.messageId)
  let feedbackThread
  if (data.feedbackThreadId) {
    feedbackThread = await fetchFeedbackThread(data.feedbackThreadId)
  }

  logger.trace('API requests successful')

  logger.trace('Resolving votes')
  // Fetch the vote data
  const votes = await fetchVotes(data.votes)
  const drafts = await fetchDrafts(data.drafts)

  const submission: ValidatedSubmission = {
    ...data,
    state: data.state,

    reviewThread,
    feedbackThread,
    submissionMessage,
    author,
    tech: data.techUsed,
    links: {
      other: data.otherLinks,
      source: data.sourceLinks
    },

    votes,
    drafts
  }

  return submission
}

export async function validatePendingSubmission (
  submission: PendingSubmission
): Promise<ValidatedSubmission> {
  logger.debug(
    `Beginning resolution of pending submission ${stringify.submission(
      submission
    )}`
  )

  logger.trace('Querying for missing data')
  const data = await query((db) =>
    db.submission.findUniqueOrThrow({
      where: {
        id: submission.id
      },
      select: {
        messageId: true,
        reviewThreadId: true,
        feedbackThreadId: true
      }
    })
  )
  logger.trace('Query successful')

  logger.trace('Asserting required DB columns exist')
  // Assert the data required for a 'processing' or 'paused' state submission exists
  assert(!!data.reviewThreadId, 'review thread id did not exist')
  assert(!!data.messageId, 'message id did not exist')
  logger.trace('Data exists')

  // Fetch all required data to form a ValidatedSubmission
  logger.trace('Making API requests to fetch required data')
  const author = await fetchAuthor(submission.authorId)
  const reviewThread = await fetchReviewThread(data.reviewThreadId)
  const submissionMessage = await fetchOriginalMessage(data.messageId)
  let feedbackThread
  if (data.feedbackThreadId) {
    feedbackThread = await fetchFeedbackThread(data.feedbackThreadId)
  }
  logger.trace('API requests successful')

  const validated: ValidatedSubmission = {
    ...submission,
    // We assume we go into the processing state
    state: 'PROCESSING',

    reviewThread,
    feedbackThread,
    submissionMessage,
    author,

    // We assume it has no votes or drafts
    votes: [],
    drafts: []
  }

  logger.debug(`Resolved submission ${stringify.submission(validated)}`)

  return validated
}

export async function updateSubmissionState (
  submission: PendingSubmission | ValidatedSubmission,
  newState: SubmissionState
): Promise<void> {
  logger.debug(
    `Updating state for submission ${stringify.submission(
      submission
    )} to ${newState}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        state: newState
      }
    })
  )
}

interface DbGeneratedData {
  id: SubmissionId
  submittedAt: Date
}

export async function saveApiData (
  submission: ApiSubmission
): Promise<DbGeneratedData> {
  logger.debug(`Persisting API data ${stringify.submission(submission)}`)
  const data = await query((db) =>
    db.submission.create({
      data: {
        state: 'RAW',

        name: submission.name,
        description: submission.description,
        authorId: submission.authorId,
        techUsed: submission.tech,
        sourceLinks: submission.links.source,
        otherLinks: submission.links.other
      }
    })
  )

  return {
    id: data.id,
    submittedAt: data.submittedAt
  }
}

export async function updateReviewThreadId (
  submission: ValidatedSubmission | PendingSubmission,
  newId: Snowflake
): Promise<void> {
  logger.debug(
    `Updating review thread id for submission ${stringify.submission(
      submission
    )} to ${newId}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        reviewThreadId: newId
      }
    })
  )
}

export async function updateFeedbackThreadId (
  submission: ValidatedSubmission | PendingSubmission,
  newId: Snowflake
): Promise<void> {
  logger.debug(
    `Updating review feedback thread id for submission ${stringify.submission(
      submission
    )} to ${newId}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        feedbackThreadId: newId
      }
    })
  )
}

export async function updateSubmissionMessageId (
  submission: ValidatedSubmission | PendingSubmission,
  newId: Snowflake
): Promise<void> {
  logger.debug(
    `Updating submission message id for submission ${stringify.submission(
      submission
    )} to ${newId}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        messageId: newId
      }
    })
  )
}

export async function updateAuthorId (
  submission: ValidatedSubmission | PendingSubmission,
  newId: Snowflake
): Promise<void> {
  logger.debug(
    `Updating author id for submission ${stringify.submission(
      submission
    )} to ${newId}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        authorId: newId
      }
    })
  )
}

export async function updateName (
  submission: ValidatedSubmission | PendingSubmission,
  newName: string
): Promise<void> {
  logger.debug(
    `Updating name for submission ${stringify.submission(
      submission
    )} to ${newName}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        name: newName
      }
    })
  )
}

export async function updateDescription (
  submission: ValidatedSubmission | PendingSubmission,
  newDescription: string
): Promise<void> {
  logger.debug(
    `Updating description for submission ${stringify.submission(
      submission
    )} to ${newDescription}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        description: newDescription
      }
    })
  )
}

export async function updateSourceLink (
  submission: ValidatedSubmission | PendingSubmission,
  newLink: string
): Promise<void> {
  logger.debug(
    `Updating source link for submission ${stringify.submission(
      submission
    )} to ${newLink}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        sourceLinks: newLink
      }
    })
  )
}

export async function updateOtherLink (
  submission: ValidatedSubmission | PendingSubmission,
  newLink: string
): Promise<void> {
  logger.debug(
    `Updating other link for submission ${stringify.submission(
      submission
    )} to ${newLink}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        otherLinks: newLink
      }
    })
  )
}

export async function updateTechnologies (
  submission: ValidatedSubmission | PendingSubmission,
  newTechnologies: string
): Promise<void> {
  logger.debug(
    `Updating technologies for submission ${stringify.submission(
      submission
    )} to ${newTechnologies}`
  )
  return void query((db) =>
    db.submission.update({
      where: {
        id: submission.id
      },
      data: {
        techUsed: newTechnologies
      }
    })
  )
}

interface Ids {
  reviewThreadId?: Snowflake
  feedbackThreadId?: Snowflake
  submissionMessageId?: Snowflake
  authorId: Snowflake
}

export async function fetchDiscordIdsForSubmission (
  submission: PendingSubmission
): Promise<Ids> {
  const data = await query((db) =>
    db.submission.findUniqueOrThrow({
      where: {
        id: submission.id
      },
      select: {
        messageId: true,
        reviewThreadId: true,
        feedbackThreadId: true
      }
    })
  )

  return {
    reviewThreadId: data.reviewThreadId ?? undefined,
    feedbackThreadId: data.feedbackThreadId ?? undefined,
    submissionMessageId: data.messageId ?? undefined,
    authorId: submission.authorId
  }
}
