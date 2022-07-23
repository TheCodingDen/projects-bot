import { Guild, Snowflake } from 'discord.js'
import { Manager } from '.'
import { ResolvedSubmission, SubmissionVotes } from '../models/schema/submission'
import { Submission as SubmissionModel } from '../models/submission'
import { Vote } from '../models/vote'
import { Vote as StoredVote } from '@prisma/client'
import { log } from '../utils/logger'
import { Err, Ok, Result } from 'ts-results'

function hasDetails<T extends {details: unknown}> (x: T): x is T & {details: NonNullable<T['details']>} {
  return x.details !== null && x.details !== undefined
}

/**
 * SubmissionsManager manages all submissions in the bot. Submissions come from the HTTP API.
 * Submissions stored here are cached in a Map, where the key is the Submission#id.
 *
 * @see Submission
 */
export class SubmissionsManager extends Manager {
  private readonly cache = new Map<Snowflake, SubmissionModel>()

  private async resolveVotes (votes: StoredVote[], guild: Guild): Promise<Result<Vote[], Error>> {
    return Result.all(...await Promise.all(votes.map(async v => await this.client.votes.resolve(v, guild))))
  }

  private async resolve (data: ResolvedSubmission): Promise<Result<SubmissionModel, Error>> {
    const authorRes = await Result.wrapAsync(async () => await this.client.users.fetch(data.details.authorId))

    if (authorRes.err) {
      // TODO: reject project here using the client user & a preset reason
      return Err(authorRes.val as Error)
    }

    const { privateSubmission } = this.client.config.channels()

    const msgRes = await Result.wrapAsync(async () => await privateSubmission.messages.fetch(data.details.messageId))

    if (msgRes.err) {
      // TODO: reject project here using the client user & a preset reason
      return Err(msgRes.val as Error)
    }

    const message = msgRes.val
    const author = authorRes.val

    const groupedVotes = {
      upvotes: {
        staff: [] as StoredVote[],
        veterans: [] as StoredVote[]
      },
      downvotes: {
        staff: [] as StoredVote[],
        veterans: [] as StoredVote[]
      },
      pauses: [] as StoredVote[]
    }

    for (const vote of data.votes) {
      if (vote.type === 'PAUSE') {
        // Handle this logic here and continue to make the logic below cleaner
        groupedVotes.pauses.push(vote)
        continue
      }

      const type = vote.type === 'UP' ? 'upvotes' : 'downvotes'
      const role = vote.role === 'STAFF' ? 'staff' : 'veterans'
      groupedVotes[type][role].push(vote)
    }

    const voteResults = Result.all(
      await this.resolveVotes(groupedVotes.upvotes.staff, privateSubmission.guild),
      await this.resolveVotes(groupedVotes.upvotes.veterans, privateSubmission.guild),
      await this.resolveVotes(groupedVotes.downvotes.staff, privateSubmission.guild),
      await this.resolveVotes(groupedVotes.downvotes.veterans, privateSubmission.guild),
      await this.resolveVotes(groupedVotes.pauses, privateSubmission.guild)
    )

    if (voteResults.err) {
      return Err(voteResults.val)
    }

    const [staffUp, veteransUp, staffDown, veteransDown, pauses] = voteResults

    const votes: SubmissionVotes = {
      upvotes: {
        staff: staffUp,
        veterans: veteransUp
      },
      downvotes: {
        staff: staffDown,
        veterans: veteransDown
      },
      pauses
    }

    return Ok(new SubmissionModel(this.client, data, author, message, votes))
  }

  /**
   * Fetch a Submission from the database by its ID. The returned submission will be fully validated and have all data populated.
   * This will use cached data if available.
   *
   * This method will return an error in the following cases:
   *   - Submission not found (No submission was found with the provided ID)
   *   - Submission data was invalid (DB schema failed)
   *   - Submission author could not be resolved (Invalid User ID)
   *   - Submission message could not be resolved (Invalid Message ID)
   *   - Submission votes could not be resolved (Invalid voter ID)
   */
  async fetch (id: Snowflake): Promise<Result<SubmissionModel, Error>> {
    const cached = this.cache.get(id)

    if (cached) {
      return Ok(cached)
    }

    const dbRes = await this.client.db.exec(db => db.submission.findUnique({
      where: { id },
      include: {
        links: true,
        votes: true,
        details: true,
        relatedMessages: true,
        drafts: {
          orderBy: {
            timestamp: 'desc'
          }
        }
      }
    }))

    if (dbRes.err) {
      return Err(dbRes.val)
    }

    const data = dbRes.val

    if (!data) {
      return Err(new Error(`DB returned no matches for ID ${id}`))
    }

    if (!hasDetails(data)) {
      return Err(new Error(`DB returned no details for ${id}`))
    }

    log.debug(`Loaded project from DB: ${JSON.stringify(dbRes)}`)

    return await this.resolve(data)
  }

  async exists (id: Snowflake): Promise<boolean> {
    if (this.cache.has(id)) {
      return true
    }
    const sameId = await this.client.db.exec(
      (db) => db.submission.findUnique({ where: { id } })
    )
    return !!sameId
  }

  async getIdForMessageId (messageId: Snowflake): Promise<Result<string, Error>> {
    const idRes = await this.client.db.exec(db => db.submissionDetails.findUnique({
      where: { messageId },
      select: {
        submissionId: true
      }
    }))

    return idRes
      .andThen(s => s === null ? Err(new Error(`No submission found for message ID ${messageId}`)) : Ok(s))
      .map(s => s.submissionId)
  }

  async generateId (): Promise<Result<string, Error>> {
    const submission = await this.client.db.exec(db => db.submission.create({
      data: {}
    }))

    return submission.map(s => s.id)
  }

  /**
   * Add a Submission to the database. This will also push the submission to the cache.
   */
  async add (submission: SubmissionModel): Promise<Result<void, Error>> {
    const data = submission.toSerialised()
    return await this.client.db.exec(async (db) => {
      // The DB already has a record for the submission, we just have to link up the rest of the data.

      log.debug(`Linking details for submission ${submission}`)
      await db.submissionDetails.create({
        data: {
          ...data.details
        }
      })

      log.debug(`Linking links for submission ${submission}`)

      await db.submissionLink.createMany({
        data: [
          ...data.links
        ]
      })

      log.debug(`Finished adding submission ${submission} to the DB)`)

      // Expliclty insert after we push to the DB to avoid invalid cache state
      this.cache.set(submission.id, submission)
    })
  }

  /**
   * Update a Submission in the database. This will also update the submission in the cache.
   */
  async update (submission: SubmissionModel): Promise<Result<void, Error>> {
    const data = submission.toSerialised()
    log.debug(`Updating ${submission}, new state ${JSON.stringify(data)}`)

    return await this.client.db.exec(async db => {
      await db.submissionDetails.update({
        where: { submissionId: submission.id },
        data: data.details
      })

      // TODO: improve this query

      // We delete and recreate the votes to easily update any changed votes
      await db.vote.deleteMany({
        where: { submissionId: submission.id }
      })

      await db.vote.createMany({
        data: data.votes
      })

      // Expliclty insert after we push to the DB to avoid invalid cache state
      this.cache.set(submission.id, submission)
    })
  }

  /**
  * Removes a Submission from the database. This will also remove the submission from the cache.
  */
  async remove (submission: SubmissionModel | Snowflake): Promise<Result<void, Error>> {
    log.debug(`Removing ${submission} from the DB`)

    return await this.client.db.exec(async (db) => {
      const id = submission instanceof SubmissionModel ? submission.id : submission

      await db.submissionDetails.update({
        where: { submissionId: id },
        data: {
          state: 'DELETED'
        }
      })

      // Expliclty delete after we remove from the DB to avoid invalid cache state
      this.cache.delete(id)
    })
  }

  async underReview (): Promise<Result<SubmissionModel[], Error>> {
    log.debug('Fetching all submissions with state==PROCESSING')

    const dbRes = await this.client.db.exec(db => db.submission.findMany({
      where: { details: { state: 'PROCESSING' } },
      include: {
        links: true,
        votes: true,
        details: true,
        relatedMessages: true,
        drafts: {
          orderBy: {
            timestamp: 'desc'
          }
        }
      }
    }))

    if (dbRes.err) {
      return Err(dbRes.val)
    }

    const data = dbRes.val

    log.debug(`Fetched ${data.length} entries`)

    const res = await Promise.all(data.map(d => {
      if (!hasDetails(d)) {
        return Err(new Error(`Could not find details for submission ${d.id}`))
      }

      return this.resolve(d)
    }))

    return Result.all(...res)
  }

  async fetchByThreadId (reviewThreadId: Snowflake): Promise<Result<SubmissionModel | undefined, Error>> {
    log.debug(`Fetching submission by review thread ID: ${reviewThreadId}`)

    const dbRes = await this.client.db.exec(db => db.submissionDetails.findUnique({
      where: { reviewThreadId },
      include: {
        submission: {
          select: {
            id: true,
            relatedMessages: true,
            drafts: {
              orderBy: {
                timestamp: 'desc'
              }
            }
          }
        },
        links: true,
        votes: true
      }
    }))

    if (dbRes.err) {
      return Err(dbRes.val)
    }

    const data = dbRes.val

    // Return `undefined` as the not found case, that isn't exceptional
    // This could happen if the thread is deleted, for example.
    if (!data) {
      log.debug(`Could not locate submission for review thread ${reviewThreadId}`)
      return Ok(undefined)
    }

    const formatted = {
      id: data.submissionId,
      details: data,
      relatedMessages: data.submission.relatedMessages,
      drafts: data.submission.drafts,
      ...data
    }

    const model = await this.resolve(formatted)
    log.debug(`Resolved submission ${model} for review thread ${reviewThreadId}`)

    return model
  }
}
