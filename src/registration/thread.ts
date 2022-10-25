import { Message, ThreadChannel } from 'discord.js'
import { ApiSubmission } from '../types/submission'

export async function createPrivateReviewThread (
  submission: ApiSubmission,
  submissionMessage: Message
): Promise<ThreadChannel> {
  return await submissionMessage.startThread({
    name: submission.name
  })
}
