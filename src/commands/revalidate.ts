import { SlashCommand, SlashCreator, CommandContext } from 'slash-create'
import { commandLog } from '../communication/interaction'
import { privateLog } from '../communication/private'
import {
  updateSubmissionState,
  validatePendingSubmission
} from '../db/submission'
import { isValidated } from '../types/submission'
import { fetchSubmissionForContext } from '../utils/commands'
import { getAssignedGuilds } from '../utils/discordUtils'
import { createEmbed, updateMessage } from '../utils/embed'
import { stringify } from '../utils/stringify'

export default class RevalidateCommand extends SlashCommand {
  constructor (creator: SlashCreator) {
    super(creator, {
      name: 'revalidate',
      description:
        'Revalidate a submission, removing warnings if it is successful.',
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
    if (isValidated(submission)) {
      logger.debug('Clear halting, submission in validated state')
      return void commandLog.warning({
        type: 'text',
        content: 'Submission has no warnings.',
        ctx
      })
    }

    try {
      const validated = await validatePendingSubmission(submission)

      validated.state = 'PROCESSING'
      await updateSubmissionState(submission, 'PROCESSING')
      await updateMessage(validated.submissionMessage, createEmbed(validated))

      logger.debug('Clear complete.')
      commandLog.info({
        type: 'text',
        content: 'Cleared warnings successfully.',
        ctx,
        extraOpts: {
          ephemeral: false
        }
      })

      privateLog.info({
        type: 'embed',
        embed: {
          title: validated.name,
          description: `**${ctx.user.username}#${ctx.user.discriminator}** cleared warnings.`,
          fields: [
            {
              name: 'ID',
              value: validated.id
            },
            {
              name: 'Source',
              value: validated.links.source
            },
            {
              name: 'Author',
              value: `<@${validated.author.id}> (@${validated.author.user.username}, ${validated.author.id})`
            }
          ]
        },
        ctx: validated
      })
    } catch (err) {
      commandLog.error({
        type: 'text',
        content: 'Failed to clear warnings, submission likely broken.',
        ctx
      })
    }
  }
}
