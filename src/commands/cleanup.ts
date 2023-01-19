import assert from 'assert'
import { SlashCommand, SlashCreator, CommandContext, CommandOptionType } from 'slash-create'
import { commandLog } from '../communication/interaction'
import { privateLog } from '../communication/private'
import config from '../config'
import { updateSubmissionState } from '../db/submission'
import { isPending } from '../types/submission'
import { fetchSubmissionForContext } from '../utils/commands'
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

    const submission = await fetchSubmissionForContext(ctx)

    if (!submission) {
      return
    }

    if (isPending(submission)) {
      return commandLog.warning({
        type: 'text',
        content: 'Cannot cleanup pending submissions, use revalidate first.',
        ctx
      })
    }

    if (state === 'accepted') {
      await updateSubmissionState(submission, 'ACCEPTED')
    } else {
      await updateSubmissionState(submission, 'DENIED')
    }

    const errored = runCatching(async () => {
      await submission.reviewThread.setArchived(true)
      await submission.submissionMessage.delete()
    }, 'suppress') !== undefined

    if (errored) {
      return commandLog.error({
        type: 'text',
        content: 'Failed to cleanup, Discord API error occurred',
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
            value: `<@${submission.author.id}> (${submission.author.user.tag}, ${submission.author.id})`
          }
        ],
        color: config.colours().log.info
      },
      ctx: submission
    })
  }
}
