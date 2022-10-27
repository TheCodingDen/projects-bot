import { Message, ThreadChannel } from 'discord.js'
import { ApiSubmission } from '../types/submission'

/**
 * Creates the private review thread used to discuss submissions for the given submission.
 * This does not persist the new thread ID.
 */
export async function createPrivateReviewThread (
  submission: ApiSubmission,
  submissionMessage: Message
): Promise<ThreadChannel> {
  return await submissionMessage.startThread({
    name: submission.name
  })
}
