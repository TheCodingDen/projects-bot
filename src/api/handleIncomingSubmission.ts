import { hasSPDXLicense, isEligibleForLicenseCheck } from '../utils/licenseCheck'
import { checkForDuplicates } from '../db'
import { log } from '../utils/logger'
import { embeds } from '../utils/embeds'
import { ProjectsClient } from '../client'
import createReviewThread from '../utils/createReviewThread'
import { IncomingSubmissionData, SubmissionVotes } from '../models/schema/submission'
import { Draft, RelatedMessage, SubmissionLink, Vote } from '@prisma/client'
import { Submission } from '../models/submission'
import { assert } from '../utils/assert'
import { Err, Ok, Result } from 'ts-results'

/**
 * The default API submission handler. This handles submissions that come in from the HTTP API and dispatches them for voting.
 *
 * Performs the following steps:
 *   - Resolve submission author based on user provided ID
 *   - Submit voting message to private voting channel
 *   - Add voting reactions to submission message
 *   - Query GitHub (if applicable) for licence status of the submission
 *   - Query the DB for similar submissions, to check for duplicate submissions
 *   - Register the submission for voting via submissions manager and persist it in the DB
 */
const handler = async (apiSubmission: IncomingSubmissionData, client: ProjectsClient): Promise<Result<unknown, Error>> => {
  // Before proceeding further, register with the DB. This cannot fail, if it does, we abort.
  const idRes = await client.submissions.generateId()

  if (idRes.err) {
    return Err(idRes.val)
  }

  const id = idRes.val

  const submission = {
    id,
    relatedMessages: [] as RelatedMessage[],
    votes: [] as Vote[],
    drafts: [] as Draft[],
    links: [
      {
        submissionId: id,
        submissionDetailsId: id,
        type: 'SOURCE',
        url: apiSubmission.links.source
      },
      {
        submissionId: id,
        submissionDetailsId: id,
        type: 'OTHER',
        url: apiSubmission.links.other
      }
    ] as SubmissionLink[],

    details: {
      name: apiSubmission.name,
      authorId: apiSubmission.author,
      description: apiSubmission.description,
      techUsed: apiSubmission.tech,
      state: 'PROCESSING' as const,

      // IDs, to be set,
      messageId: '',
      reviewThreadId: '',
      submissionId: id
    }

  }

  // Fetch project author
  const authorRes = await Result.wrapAsync(async () => await client.users.fetch(apiSubmission.author))

  if (authorRes.err) {
    const err = authorRes.val

    log.error(`Could not fetch author for submission ${apiSubmission.name}`)
    log.error(err)

    // TODO: reject the project here and cease processing
    // Don't relate this, we don't have an ID to relate to.
    await client.communication.reportWarning(`Could not fetch project author; ID (${apiSubmission.author})`, {
      name: submission.details.name,
      shouldRelate: false
    })

    return Err(err as Error)
  }

  const author = authorRes.val

  // Submit message to review channel
  const messageRes = await Result.wrapAsync(async () => {
    // Pass in the raw data since it's in the right shape already
    const embed = embeds.privateSubmission(apiSubmission, author)

    return await client.config.channels().privateSubmission.send({ embeds: [embed] })
  })

  if (messageRes.err) {
    const err = messageRes.val

    log.error(`Could not send submission message to review channel for submission ${submission.details.name}`)
    log.error(err)

    // Don't relate this, we don't have an ID to relate to.
    await client.communication.reportError('Could not send submission embed due to discord error', {
      name: submission.details.name,
      shouldRelate: false
    })

    return Err(err as Error)
  }

  const message = messageRes.val

  submission.details.messageId = message.id

  const blankResolvedVotes: SubmissionVotes = {
    upvotes: {
      staff: [],
      veterans: []
    },
    downvotes: {
      staff: [],
      veterans: []
    },
    pauses: []
  }

  // Create the review thread
  const reviewThreadRes = await createReviewThread(submission, message)

  if (reviewThreadRes.err) {
    log.error(`Encountered error whilst creating private review thread for submission ${submission.id} ${submission.details.name}`)
    log.error(reviewThreadRes.val)

    await client.communication.reportError('Could not create review thread', { ...submission, name: submission.details.name })

    return Err(reviewThreadRes.val)
  }

  const reviewThreadId = reviewThreadRes.val
  submission.details.reviewThreadId = reviewThreadId

  assert(!!submission.details.messageId, 'submission.details.messageId was not set')
  assert(!!submission.details.reviewThreadId, 'submission.details.reviewThreadId was not set')

  // Create the model
  const model = new Submission(client, submission, author, message, blankResolvedVotes)

  // Check for license
  if (isEligibleForLicenseCheck(model)) {
    const hasLicenseRes = await hasSPDXLicense(model, client)

    if (hasLicenseRes.err) {
      log.error(`License check for submission ${model} failed`)
      log.error(hasLicenseRes.val)

      // We can continue here because license checks aren't critical. This is still an error though.
      await client.communication.reportError('Could not check submission for license file, GitHub API returned an error', model)
    }

    if (!hasLicenseRes.val) {
      log.warn(`No license detected for project ${submission.details.name} with source link ${model.links.source} ${model}`)
      await client.communication.reportWarning('No license file was reported by GitHub, additional review recommended', model)
    }
  }

  // Perform duplicate check

  const isDuplicateRes = await checkForDuplicates(model, client)

  if (isDuplicateRes.err) {
    log.error(`Duplicate checking for submission ${model} failed`)
    log.error(isDuplicateRes.val)

    // We can continue here because duplicate checks arent critical. This is still an error though.
    void client.communication.reportError('Duplication check failed, database threw an error', model)
  }

  const isDuplicate = isDuplicateRes.val

  if (isDuplicate) {
    log.warn(`Duplicate detected for source link ${model.links.source} (${model})`)
    void client.communication.reportWarning('Duplicate submission detected (one or more projects with the same name and / or repository link found), additional review recommended', model)
  }

  const submissionAddRes = await client.submissions.add(model)

  if (submissionAddRes.ok) {
    log.info(`Project ${model.name} (${message.id}) registered for voting.`)
  } else {
    log.error(`Project registration for submission ${model} failed`)
    log.error(submissionAddRes.val)

    // We want to abort here because the DB is misconfigured at best and non functional at worst
    await client.communication.reportError('Database threw an error while attempting to register the project', model)
    return Err(submissionAddRes.val)
  }

  // Add reactions
  // Do this after we register so that people dont vote too early

  const { upvote, downvote, pause } = client.config.emojis()

  const reactionRes = await Result.wrapAsync(async () =>
    await Promise.all([
      message.react(upvote),
      message.react(downvote),
      message.react(pause)
    ])
  )

  if (reactionRes.err) {
    const err = reactionRes.val

    log.error(`Could not add voting reactions for submission ${model}`)
    log.error(err)

    await client.communication.reportError('Could not add voting reactions to submission message due to discord error', model)

    return Err(err as Error)
  }

  return Ok.EMPTY
}

export default handler
