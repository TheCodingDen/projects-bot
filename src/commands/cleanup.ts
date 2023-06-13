import assert from 'assert'
import {
  SlashCommand,
  SlashCreator,
  CommandContext,
  CommandOptionType
} from 'slash-create'
import { commandLog } from '../communication/interaction'
import { internalLog } from '../communication/internal'
import { privateLog } from '../communication/private'
import config from '../config'
import {
  fetchAnySubmissionByThreadId,
  updateSubmissionState
} from '../db/submission'
import { isCompleted, isValidated } from '../types/submission'
import { getAssignedGuilds } from '../utils/discordUtils'
import { runCatching } from '../utils/request'

export default class CleanupCommand extends SlashCommand {
  constructor (creator: SlashCreator) {
    super(creator, {
      name: 'cleanup',
      description: 'Cleanup a submission, moving it to accepted / denied state',
      guildIDs: getAssignedGuilds({ includeMain: true }),
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'state',
          description: 'The state to move to',
          required: true,
          choices: [
            { name: 'Accepted', value: 'accepted' },
            { name: 'Denied', value: 'denied' }
          ]
        }
      ]
    })
  }

  async run (ctx: CommandContext): Promise<void> {
    // Discord validates this
    const state = ctx.options.state as 'denied' | 'accepted'

    // This would be a Discord API failure
    assert(!!state, 'no state set')

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

    if (!submission || submission.state === 'RAW') {
      return
    }

    if (state === 'accepted' && !isCompleted(submission)) {
      await updateSubmissionState(submission, 'ACCEPTED')
    } else if (state === 'denied' && !isCompleted(submission)) {
      await updateSubmissionState(submission, 'DENIED')
    }

    const deletionResult = await runCatching(async () => {
      if (isValidated(submission)) {
        await submission.reviewThread.setArchived(true)
        await submission.submissionMessage.delete()

        return 'deleted'
      }

      return 'not-delete'
    }, 'suppress')

    if (deletionResult === undefined) {
      return commandLog.error({
        type: 'text',
        content: 'Failed to cleanup, Discord API error occurred',
        ctx
      })
    } else if (deletionResult === 'deleted') {
      commandLog.error({
        type: 'text',
        content: 'Cleaned up message & channel',
        ctx
      })
    } else {
      commandLog.error({
        type: 'text',
        content:
          'Could not cleanup, channel / message unavailable, please delete manually.',
        ctx
      })
    }

    privateLog.info({
      type: 'embed',
      embed: {
        title: submission.name,
        description: `**${ctx.user.username}#${ctx.user.discriminator}** **__CLEANED__** the submission.`,
        fields: [
          {
            name: 'ID',
            value: submission.id
          },
          {
            name: 'Source',
            value: submission.links.source
          },
          {
            name: 'Author',
            value: `<@${submission.authorId}> (${
              isValidated(submission)
                ? `@${submission.author.user.username}`
                : '@unknown-user'
            }, ${submission.authorId})`
          }
        ],
        color: config.colours().log.info
      },
      ctx: submission
    })
  }
}
