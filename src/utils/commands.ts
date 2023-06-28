import { CommandContext } from 'slash-create'
import { commandLog } from '../communication/interaction'
import { internalLog } from '../communication/internal'
import { fetchAnySubmissionByThreadId, fetchSubmissionByThreadId } from '../db/submission'
import { AnySubmission, PendingSubmission, ValidatedSubmission } from '../types/submission'

/**
 * Fetches the submission for the given command context.
 * This does NOT validate the state of the submission in any way
 * This relies on the thread ID to perform the lookup.
 */
export async function fetchAnySubmissionForContext (ctx: CommandContext): Promise<AnySubmission | undefined> {
  const id = ctx.channelID

  if (!id) {
    return void commandLog.error({
      type: 'text',
      content: 'Interaction came with no thread ID.',
      ctx
    })
  }

  const submission = await fetchAnySubmissionByThreadId(id)

  if (!submission) {
    commandLog.error({
      type: 'text',
      content: `Could not look up submission for channel ID ${id}`,
      ctx
    })

    return void internalLog.error({
      type: 'text',
      content: `Could not look up submission for channel ID ${id}`,
      ctx: undefined
    })
  }

  return submission
}

/**
 * Fetches the submission for the given command context.
 * This relies on the thread ID to perform the lookup.
 */
export async function fetchSubmissionForContext (ctx: CommandContext): Promise<ValidatedSubmission | PendingSubmission | undefined> {
  const id = ctx.channelID

  if (!id) {
    return void commandLog.error({
      type: 'text',
      content: 'Interaction came with no thread ID.',
      ctx
    })
  }

  const submission = await fetchSubmissionByThreadId(id)

  if (!submission) {
    commandLog.error({
      type: 'text',
      content: `Could not look up submission for channel ID ${id}`,
      ctx
    })

    return void internalLog.error({
      type: 'text',
      content: `Could not look up submission for channel ID ${id}`,
      ctx: undefined
    })
  }

  return submission
}
