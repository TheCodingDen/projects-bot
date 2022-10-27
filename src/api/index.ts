import assert from 'assert'
import { ActionRowBuilder, ButtonBuilder } from 'discord.js'
import Fastify, { FastifyInstance } from 'fastify'
import config from '../config'
import {
  saveApiData,
  updateAuthorId,
  updateReviewThreadId,
  updateSubmissionMessageId,
  updateSubmissionState
} from '../db/submission'
import {
  runCriticalChecks,
  runNonCriticalChecks
} from '../registration/checks'
import { createPrivateReviewThread } from '../registration/thread'
import {
  ApiSubmission,
  PendingSubmission,
  ValidatedSubmission
} from '../types/submission'
import { VOTING_BUTTONS } from '../utils/buttons'
import { createEmbed, updateMessage } from '../utils/embed'
import { stringify } from '../utils/stringify'
import { apiSubmissionSchema } from './schema'

const server: FastifyInstance = Fastify({})

server.get('/health', async () => {
  return { healthy: true }
})

server.post(
  '/submissions',
  { schema: { body: apiSubmissionSchema } },
  async (req, res) => {
    // Validate the JSON shape
    const body = req.body

    logger.debug(`Received incoming request (user-agent: ${req.headers['user-agent']}) (body: ${JSON.stringify(body)})`)

    logger.trace('Validating body')

    // Should be true if Fastify properly validates the incoming data
    assert(typeof body === 'object' && !!body, 'body was not an object')

    logger.trace('Body was valid')

    // Fastify validated the shape for us
    const submission = body as ApiSubmission

    // This is the only valid value for this type, but the client wont provide it so we set it here
    submission.state = 'RAW'

    // Send embed to private submissions channel
    logger.trace('Sending embed to private submissions channel')
    const embed = createEmbed(submission)
    const { privateSubmissions } = config.channels()

    const submissionMessage = await privateSubmissions.send({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(...VOTING_BUTTONS)
      ]
    })
    logger.trace('Sent embed to private submissions channel')

    // Create attached review thread
    logger.trace('Creating private review thread')
    const reviewThread = await createPrivateReviewThread(
      submission,
      submissionMessage
    )
    logger.trace('Created private review thread')

    logger.trace('Saving API data')
    // Save API data to get submission ID and creation date
    const { id: submissionId, submittedAt } = await saveApiData(submission)
    logger.trace(`Saved API data (id: ${submissionId}) (submittedAt: ${submittedAt.toLocaleString()})`)

    // Run critical checks
    logger.trace('Running critical checks')
    const criticalResult = await runCriticalChecks(submission, reviewThread)
    logger.trace(`Critical checks pass: ${criticalResult.error}`)

    if (criticalResult.error) {
      logger.error(
        `Critical check failed for submission ${stringify.submission(submission)} with reason ${criticalResult.message}`
      )

      // Prove we have enough data for a pending submission
      const pendingSubmission: PendingSubmission = {
        ...submission,

        id: submissionId,
        submittedAt,
        state: 'ERROR'
      }

      // Move to error state
      await updateSubmissionState(pendingSubmission, 'ERROR')
      await updateMessage(submissionMessage, createEmbed(pendingSubmission))

      // Set the remaning data we have, still not enough for a fully validated submission
      // but we still managed to get the thread and message
      await updateReviewThreadId(pendingSubmission, reviewThread.id)
      await updateSubmissionMessageId(pendingSubmission, submissionMessage.id)

      // Abort here, we will need user intervention to continue
      res.statusCode = 400
      return { error: true, statusCode: 400, message: 'Critical check failed.' }
    }

    const { author } = criticalResult

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

    logger.debug(`Working with submission ${stringify.submission(validatedSubmission)}`)

    // Set the remaning data needed to make up the validated submission
    await updateAuthorId(validatedSubmission, author.id)
    await updateReviewThreadId(validatedSubmission, reviewThread.id)
    await updateSubmissionMessageId(validatedSubmission, submissionMessage.id)

    logger.trace('Running non critical checks')
    // Run non critical checks
    const didChecksPass = await runNonCriticalChecks(validatedSubmission)
    logger.trace(`Non critical checks pass: ${didChecksPass}`)

    if (!didChecksPass) {
      logger.info(`Non critical checks failed for submission ${stringify.submission(validatedSubmission)}`)
      // Move to warning state
      await updateSubmissionState(validatedSubmission, 'WARNING')

      const pendingSubmission: PendingSubmission = {
        ...validatedSubmission,
        state: 'WARNING'
      }

      await updateMessage(submissionMessage, createEmbed(pendingSubmission))
    } else {
      // Update the embed with our new data
      await updateSubmissionState(validatedSubmission, 'PROCESSING')
      await updateMessage(submissionMessage, createEmbed(validatedSubmission))
    }

    res.statusCode = 204
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
