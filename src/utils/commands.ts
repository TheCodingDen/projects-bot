import { CommandContext } from 'slash-create'
import { commandLog } from '../communication/interaction'
import { internalLog } from '../communication/internal'
import { fetchSubmissionByThreadId } from '../db/submission'
import { PendingSubmission, ValidatedSubmission } from '../types/submission'

export async function fetchSubmissionForContext (ctx: CommandContext): Promise<ValidatedSubmission | PendingSubmission | undefined> {
  const id = ctx.channelID

  if (!id) {
    return void commandLog.error('Interaction came with no thread ID.', ctx)
  }

  const submission = await fetchSubmissionByThreadId(id)

  if (!submission) {
    return void internalLog.error(`Could not look up submission for thread ID ${id}`, undefined)
  }

  return submission
}
