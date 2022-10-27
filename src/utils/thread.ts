import { ChannelType, Message, MessageCreateOptions, ThreadChannel } from 'discord.js'
import config from '../config'
import { updateFeedbackThreadId } from '../db/submission'
import { PendingSubmission, ValidatedSubmission } from '../types/submission'

interface ThreadCreated {
  didMakeThread: true
  thread: ThreadChannel
  message: Message
}

interface ThreadExisted {
  didMakeThread: false
  message: Message
}

/**
 * Send a message to a private feedback thread.
 * This will create one if one does not already exist, or make a new one.
 * This persists the potential new thread ID.
 */
export async function sendMessageToFeedbackThread (
  message: MessageCreateOptions,
  submission: ValidatedSubmission | PendingSubmission
): Promise<ThreadExisted | ThreadCreated> {
  // Send to existing thread if it exists
  if (submission.state === 'PROCESSING') {
    if (submission.feedbackThread) {
      return {
        didMakeThread: false,
        message: await submission.feedbackThread.send(message)
      }
    }
  }

  // If not, make one
  const { publicShowcase } = config.channels()
  const feedbackThread = await publicShowcase.threads.create({
    name: submission.name,
    // This cannot be abstracted anywhere because we need to keep the union around
    type:
      process.env.NODE_ENV === 'production'
        ? ChannelType.PrivateThread
        : ChannelType.PublicThread
  })

  await updateFeedbackThreadId(submission, feedbackThread.id)

  return {
    didMakeThread: true,
    thread: feedbackThread,
    message: await feedbackThread.send(message)
  }
}
