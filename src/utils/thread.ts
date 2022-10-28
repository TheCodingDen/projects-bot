import {
  ChannelType,
  Message,
  MessageCreateOptions,
  ThreadChannel
} from 'discord.js'
import config from '../config'
import { updateFeedbackThreadId } from '../db/submission'
import {
  isValidated,
  PendingSubmission,
  ValidatedSubmission
} from '../types/submission'
import { runCatching } from './request'

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
  if (isValidated(submission)) {
    const thread = submission.feedbackThread
    if (thread) {
      return {
        didMakeThread: false,
        message: await runCatching(async () => await thread.send(message), 'rethrow')
      }
    }
  }

  // If not, make one
  const { publicShowcase } = config.channels()
  const feedbackThread = await runCatching(
    async () =>
      await publicShowcase.threads.create({
        name: submission.name,
        // This cannot be abstracted anywhere because we need to keep the union around
        type:
          process.env.NODE_ENV === 'production'
            ? ChannelType.PrivateThread
            : ChannelType.PublicThread
      }),
    'rethrow'
  )

  await updateFeedbackThreadId(submission, feedbackThread.id)

  return {
    didMakeThread: true,
    thread: feedbackThread,
    message: await feedbackThread.send(message)
  }
}

/**
 * Updates the name of the thread if it differs from the provided name.
 */
export async function updateThreadName (
  thread: ThreadChannel,
  newName: string
): Promise<void> {
  if (thread.name === newName) {
    return
  }

  await runCatching(async () => await thread.setName(newName), 'supress')
}
