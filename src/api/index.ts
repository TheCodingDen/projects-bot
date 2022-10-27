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
    // Step 1: Validate the JSON shape
    const body = req.body

    // Should be true if Fastify properly validates the incoming data
    assert(typeof body === 'object' && !!body, 'body was not an object')

    // Fastify validated the shape for us
    const submission = body as ApiSubmission

    // This is the only valid value for this type, but the client wont provide it so we set it here
    submission.state = 'RAW'

    // Step 2: Send embed to private submissions channel
    const embed = createEmbed(submission)
    const { privateSubmissions } = config.channels()

    const submissionMessage = await privateSubmissions.send({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(...VOTING_BUTTONS)
      ]
    })

    // Step 3: Create attached review thread
    const reviewThread = await createPrivateReviewThread(
      submission,
      submissionMessage
    )

    // Save API data to get submission ID and creation date
    const { id: submissionId, submittedAt } = await saveApiData(submission)

    // Step 4: Run critical checks
    const criticalResult = await runCriticalChecks(submission, reviewThread)

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

    // Set the remaning data needed to make up the validated submission
    await updateAuthorId(validatedSubmission, author.id)
    await updateReviewThreadId(validatedSubmission, reviewThread.id)
    await updateSubmissionMessageId(validatedSubmission, submissionMessage.id)

    // Step 6: Run non critical checks
    const didChecksPass = await runNonCriticalChecks(validatedSubmission)

    if (!didChecksPass) {
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

export async function setup () {
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
