import assert from 'assert'
import { ActionRowBuilder, ButtonBuilder, Message, ThreadChannel } from 'discord.js'
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import config from '../config'
import {
  saveApiData,
  updateAuthorId,
  updateReviewThreadId,
  updateSubmissionMessageId,
  updateSubmissionState
} from '../db/submission'
import {
  ApiSubmission,
  PendingSubmission,
  ValidatedSubmission
} from '../types/submission'
import { VOTING_BUTTONS } from '../utils/buttons'
import { createEmbed, updateMessage } from '../utils/embed'
import { runCatching } from '../utils/request'
import { stringify } from '../utils/stringify'
import { runNonCriticalChecks, resolveRequiredValues } from './checks'
import { apiSubmissionSchema } from './schema'

const server: FastifyInstance = Fastify({})

server.get('/health', async () => {
  return { healthy: true }
})

interface ApiError { error: true, statusCode: number, message: string, [k: string]: unknown }
type ApiAction<T> = { error: false, data: T } | ApiError

function validateRequest (req: FastifyRequest): ApiAction<ApiSubmission> {
  // Check the request is authenticated
  if (req.headers.authorization !== config.api().key) {
    return {
      error: true,
      statusCode: 403,
      message: 'Unauthorised'
    }
  }

  // Validate the JSON shape
  const body = req.body

  logger.trace(
      `Received incoming request (body: ${JSON.stringify(body)})`
  )

  logger.trace('Validating body')

  // Should be true if Fastify properly validates the incoming data
  assert(typeof body === 'object' && !!body, 'body was not an object')

  logger.trace('Body was valid')
  return {
    error: false,
    // Fastify validated the shape for us
    data: body as ApiSubmission
  }
}

async function sendMessageToPrivateSubmission (submission: ApiSubmission): Promise<ApiAction<Message<boolean>>> {
  // Send embed to private submissions channel
  logger.trace('Sending embed to private submissions channel')
  const embed = createEmbed(submission)
  const { privateSubmissions } = config.channels()

  const submissionMessage = await runCatching(
    async () =>
      await privateSubmissions.send({
        embeds: [embed],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...VOTING_BUTTONS
          )
        ]
      }),
    'suppress'
  )

  if (!submissionMessage) {
    return {
      error: true,
      statusCode: 500,
      message: 'Failed to send submission message.'
    }
  }

  logger.trace('Sent embed to private submissions channel')

  return {
    error: false,
    data: submissionMessage
  }
}

async function createPrivateReviewThread (submission: ApiSubmission, submissionMessage: Message): Promise<ApiAction<ThreadChannel>> {
  logger.trace('Creating private review thread')
  const reviewThread = await runCatching(async () => await submissionMessage.startThread({
    name: submission.name
  }), 'suppress')

  if (!reviewThread) {
    return {
      error: true,
      statusCode: 500,
      message: 'Failed to create private review thread.'
    }
  }

  logger.trace('Created private review thread')

  return {
    error: false,
    data: reviewThread
  }
}

async function handleResolutionFailure (
  submission: PendingSubmission,
  submissionMessage: Message,
  res: FastifyReply,
  reviewThread: ThreadChannel,
  failureReason: string
): Promise<ApiError> {
  logger.error(
        `Failed to fetch required values for submission ${stringify.submission(
          submission
        )} with reason ${failureReason}`
  )

  logger.trace('Setting state and message')

  // Move to error state
  await updateSubmissionState(submission, 'ERROR')
  await updateMessage(submissionMessage, createEmbed(submission))

  logger.trace('Set state and message')

  // Set the remaning data we have, still not enough for a fully validated submission
  // but we still managed to get the thread and message

  logger.trace('Setting remaining data (review thread id and submission message id)')
  await updateReviewThreadId(submission, reviewThread.id)
  await updateSubmissionMessageId(submission, submissionMessage.id)
  logger.trace('Set remaining data (review thread id and submission message id)')

  // Abort here, we will need user intervention to continue
  res.statusCode = 400

  return {
    error: true,
    statusCode: 400,
    message: 'Failed to resolve required values.'
  }
}

async function handleRequest (req: FastifyRequest, res: FastifyReply): Promise<unknown> {
  const requestValidationResult = validateRequest(req)
  if (requestValidationResult.error) {
    return requestValidationResult
  }

  const submission = requestValidationResult.data

  // This is the only valid value for this type, but the client wont provide it so we set it here
  submission.state = 'RAW'

  logger.trace('Saving API data')
  // Save API data to get submission ID and creation date
  const { id: submissionId, submittedAt } = await saveApiData(submission)
  logger.trace(
      `Saved API data (id: ${submissionId}) (submittedAt: ${submittedAt.toLocaleString()})`
  )

  const submissionMessageResult = await sendMessageToPrivateSubmission(submission)
  if (submissionMessageResult.error) {
    return submissionMessageResult
  }

  const submissionMessage = submissionMessageResult.data

  // Create attached review thread

  const reviewThreadResult = await createPrivateReviewThread(submission, submissionMessage)
  if (reviewThreadResult.error) {
    return reviewThreadResult
  }

  const reviewThread = reviewThreadResult.data

  // Resolving required values
  logger.trace('Resolving required values')
  const valuesResult = await resolveRequiredValues(submission, reviewThread)
  logger.trace(`Required values resolved: ${!valuesResult.error}`)

  if (valuesResult.error) {
    // Prove we have enough data for a pending submission
    const pendingSubmission: PendingSubmission = {
      ...submission,

      id: submissionId,
      submittedAt,
      state: 'ERROR'
    }

    return await handleResolutionFailure(
      pendingSubmission,
      submissionMessage,
      res,
      reviewThread,
      valuesResult.message
    )
  }

  const { author } = valuesResult

  // Create validated submission
  const validatedSubmission: ValidatedSubmission = {
    ...submission,
    id: submissionId,
    submittedAt,

    state: 'PROCESSING',
    submissionMessage,
    reviewThread,
    feedbackThread: undefined,
    author,

    votes: [],
    drafts: []
  }

  logger.debug(
      `Working with submission ${stringify.submission(validatedSubmission)}`
  )

  // Set the remaning data needed to make up the validated submission
  logger.trace('Setting author id, review thread id, submission message id')
  await updateAuthorId(validatedSubmission, author.id)
  await updateReviewThreadId(validatedSubmission, reviewThread.id)
  await updateSubmissionMessageId(validatedSubmission, submissionMessage.id)
  logger.trace('Set author id, review thread id, submission message id')

  logger.trace('Running non critical checks')
  // Run non critical checks
  const didChecksPass = await runNonCriticalChecks(validatedSubmission)
  logger.trace(`Non critical checks pass: ${didChecksPass}`)

  if (!didChecksPass) {
    logger.info(
        `Non critical checks failed for submission ${stringify.submission(
          validatedSubmission
        )}`
    )
    // Move to warning state
    logger.trace('Updating submission state to WARNING')
    await updateSubmissionState(validatedSubmission, 'WARNING')
    logger.trace('Updated submission state to WARNING')

    const pendingSubmission: PendingSubmission = {
      ...validatedSubmission,
      state: 'WARNING'
    }

    await updateMessage(submissionMessage, createEmbed(pendingSubmission))
  } else {
    // Update the embed with our new data
    logger.trace('Updating submission state to PROCESSING')
    await updateSubmissionState(validatedSubmission, 'PROCESSING')
    await updateMessage(submissionMessage, createEmbed(validatedSubmission))
    logger.trace('Updated submission state to PROCESSING')
  }

  res.statusCode = 204
}

server.post(
  '/submissions',
  { schema: { body: apiSubmissionSchema } },
  async (req, res) => {
    return await handleRequest(req, res)
  }
)

server.post(
  '/',
  { schema: { body: apiSubmissionSchema } },
  async (req, res) => {
    return await handleRequest(req, res)
  }
)

export async function setup (): Promise<void> {
  try {
    await server.listen({ port: config.api().port })

    const address = server.server.address()
    const port = typeof address === 'string' ? address : address?.port

    logger.info(`Backend API listening on port ${port}`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}
