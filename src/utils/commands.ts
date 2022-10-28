import { CommandContext } from 'slash-create'
import { commandLog } from '../communication/interaction'
import { internalLog } from '../communication/internal'
import { fetchSubmissionByThreadId } from '../db/submission'
import { PendingSubmission, ValidatedSubmission } from '../types/submission'

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
    return void internalLog.error({
      type: 'text',
      content: `Could not look up submission for thread ID ${id}`,
      ctx: undefined
    })
  }

  return submission
}
