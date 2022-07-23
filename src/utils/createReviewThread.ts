import { Message, Snowflake } from 'discord.js'
import { Result } from 'ts-results'
import { ResolvedSubmission } from '../models/schema/submission'

/**
 * Creates a review thread in the private review channel.
 */
export default async (submission: ResolvedSubmission, submissionMessage: Message): Promise<Result<Snowflake, Error>> => {
  return await Result.wrapAsync(async () => {
    const thread = await submissionMessage.startThread({
      name: submission.details.name
    })

    return thread.id
  })
}
