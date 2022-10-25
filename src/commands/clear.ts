import { SlashCommand, SlashCreator, CommandContext } from 'slash-create'
import { commandLog } from '../communication/interaction'
import { privateLog } from '../communication/private'
import {
  updateSubmissionState,
  validatePendingSubmission
} from '../db/submission'
import { fetchSubmissionForContext } from '../utils/commands'
import { getAssignedGuilds } from '../utils/discordUtils'
import { createEmbed, updateMessage } from '../utils/embed'
import { stringify } from '../utils/stringify'

export default class ClearCommand extends SlashCommand {
  constructor (creator: SlashCreator) {
    super(creator, {
      name: 'clear',
      description: 'Clear warnings from a submission',
      guildIDs: getAssignedGuilds({ includeMain: true })
    })
  }

  async run (ctx: CommandContext): Promise<void> {
    const submission = await fetchSubmissionForContext(ctx)

    if (!submission) {
      return
    }

    logger.debug(
      `Starting to clear warnings for ${stringify.submission(
        submission
      )} by user ${stringify.user(ctx.user)}`
    )

    // Not in a pending state (validated instead)
    if (submission.state !== 'WARNING' && submission.state !== 'ERROR') {
      logger.debug('Clear halting, submission in validated state')
      return void commandLog.warning('Submission has no warnings.', ctx)
    }

    try {
      const validated = await validatePendingSubmission(submission)

      validated.state = 'PROCESSING'
      updateSubmissionState(submission, 'PROCESSING')
      updateMessage(validated.submissionMessage, createEmbed(validated))

      logger.debug('Clear complete.')
      commandLog.info('Cleared warnings successfully.', ctx, {
        ephemeral: false
      })

      privateLog.info(`${ctx.user.mention} cleared warnings.`, validated)
    } catch (err) {
      commandLog.error('Failed to clear warnings, submission likely broken.', ctx)
    }
  }
}
