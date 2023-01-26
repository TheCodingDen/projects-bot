import assert from 'assert'
import {
  SlashCommand,
  SlashCreator,
  CommandContext,
  CommandOptionType
} from 'slash-create'
import { commandLog } from '../communication/interaction'
import { internalLog } from '../communication/internal'
import config from '../config'
import { fetchSubmissionForContext } from '../utils/commands'
import { getAssignedGuilds } from '../utils/discordUtils'
import { stringify } from '../utils/stringify'
import { forceReject } from '../vote/action'

export default class RejectCommand extends SlashCommand {
  constructor (creator: SlashCreator) {
    super(creator, {
      name: 'reject',
      description: 'Instantly rejects a project with a preset reason.',
      guildIDs: getAssignedGuilds({ includeMain: true }),
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'reason',
          description: 'The rejection reason.',
          required: true,
          choices: config.rejection().enumValues
        }
      ]
    })
  }

  async run (ctx: CommandContext): Promise<void> {
    const { logLookup, templates } = config.rejection()
    // Discord validates the enum, thus the cast is safe
    const rawReason = ctx.options.reason as keyof typeof templates

    // This would be a Discord API failure
    assert(!!rawReason, 'no reason set')

    // Retrieve d.js member
    const member = await config.guilds().current.members.fetch(ctx.user.id)

    const submission = await fetchSubmissionForContext(ctx)

    if (!submission) {
      return
    }

    // Only allow rejection of errored projects if the reason
    // is invalid ID, not some other failure.
    if (submission.state === 'ERROR' && rawReason !== 'invalid-id') {
      commandLog.warning({
        type: 'text',
        content:
          'Cannot reject a project in an error state, please resolve the errors and retry.',
        ctx
      })
      return
    }

    if (submission.state === 'PAUSED') {
      commandLog.warning({
        type: 'text',
        content:
          'Cannot reject a paused project, please unpause the project and retry.',
        ctx
      })
      return
    }

    const template = templates[rawReason]
    const logOutput = logLookup[rawReason]

    logger.debug(
      `Starting instant rejection for submission ${stringify.submission(
        submission
      )} (reason: ${logOutput} / ${rawReason})`
    )

    // This means Discord gave us a reason that wasnt in the object,
    // could be caused by misconfiguration or API failure.
    assert(!!template, 'template was not set')
    assert(!!logOutput, 'logOutput was not set')

    const templatedReason = template({
      user: `<@${submission.authorId}>`,
      name: submission.name
    })

    commandLog.info({
      type: 'text',
      content: `Rejecting submission for reason ${logOutput}`,
      ctx,
      extraOpts: {
        ephemeral: false
      }
    })

    const rejectionResult = await forceReject(member, submission, {
      templatedReason,
      rawReason
    })

    if (rejectionResult.error) {
      // Could not reject, send template to review thread
      commandLog.info({
        type: 'text',
        content: `Failed to send feedback, please send the following message in a feedback thread: \n \`\`\`\n${templatedReason}\`\`\``,
        ctx,
        extraOpts: {
          ephemeral: false
        }
      })

      // Errors should already be reported, but doing it again does no harm
      // and provides more context in the logs than "request failed"
      internalLog.error({
        type: 'text',
        content: rejectionResult.message,
        ctx: submission
      })

      return
    }

    assert(
      rejectionResult.outcome === 'instant-reject',
      'result did not have outcome instant-reject'
    )
  }
}
