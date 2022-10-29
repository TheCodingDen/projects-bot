import assert from 'assert'
import {
  SlashCommand,
  SlashCreator,
  CommandContext,
  CommandOptionType,
  ComponentType,
  TextInputStyle,
  ModalInteractionContext
} from 'slash-create'
import { commandLog } from '../communication/interaction'
import {
  updateAuthorId,
  updateDescription,
  updateName,
  updateOtherLink,
  updateSourceLink,
  updateTechnologies,
  validatePendingSubmission
} from '../db/submission'
import {
  isValidated,
  PendingSubmission,
  ValidatedSubmission
} from '../types/submission'
import { fetchSubmissionForContext } from '../utils/commands'
import { DEFAULT_MESSAGE_OPTS_SLASH } from '../utils/communication'
import { getAssignedGuilds } from '../utils/discordUtils'
import { createEmbed, updateMessage } from '../utils/embed'
import { runCatching } from '../utils/request'
import { stringify } from '../utils/stringify'
import { updateThreadName } from '../utils/thread'

export default class EditCommand extends SlashCommand {
  constructor (creator: SlashCreator) {
    super(creator, {
      name: 'edit',
      description: 'Edit a value of a submission.',
      guildIDs: getAssignedGuilds({ includeMain: true }),
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'name',
          description: 'Edits the name of a submission'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'author',
          description: 'Edits the author of a submission'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'description',
          description: 'Edits the description of a submission'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'source',
          description: 'Edits the source links of a submission'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'other',
          description: 'Edits the other links of a submission'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'technologies',
          description: 'Edits the technologies of a submission'
        }
      ]
    })
  }

  async run (ctx: CommandContext): Promise<void> {
    const submission = await fetchSubmissionForContext(ctx)

    if (!submission) {
      return
    }

    const subcommand = ctx.subcommands[0]

    // This would be a Discord API failure
    assert(!!subcommand, 'subcommand was not set')

    logger.debug(
      `Beginning edit of ${subcommand} for ${stringify.submission(submission)}`
    )

    let oldValue: string
    let updateFn: (val: string) => void | Promise<void>

    switch (subcommand) {
      case 'name':
        oldValue = submission.name
        updateFn = async (val: string) => {
          submission.name = val
          await updateName(submission, val)
        }
        break
      case 'author':
        // Only allow author updates in error state
        if (submission.state !== 'ERROR') {
          commandLog.warning({
            type: 'text',
            content:
              'Cannot update author if the submission is not in an error state.',
            ctx
          })
          return
        }
        oldValue = submission.authorId
        updateFn = async (val: string) => {
          submission.authorId = val
          await updateAuthorId(submission, val)
        }
        break
      case 'description':
        oldValue = submission.description
        updateFn = async (val: string) => {
          submission.description = val
          await updateDescription(submission, val)
        }
        break
      case 'source':
        oldValue = submission.links.source
        updateFn = async (val: string) => {
          submission.links.source = val
          await updateSourceLink(submission, val)
        }
        break
      case 'other':
        oldValue = submission.links.other
        updateFn = async (val: string) => {
          submission.links.other = val
          await updateOtherLink(submission, val)
        }
        break
      case 'technologies':
        oldValue = submission.links.other
        updateFn = async (val: string) => {
          submission.tech = val
          await updateTechnologies(submission, val)
        }
        break
      default:
        assert(false, 'unreachable')
    }

    await ctx.sendModal(
      {
        title: `Edit the ${subcommand}`,
        components: [
          {
            type: ComponentType.ACTION_ROW,
            components: [
              {
                type: ComponentType.TEXT_INPUT,
                label: `New ${subcommand}`,
                style: TextInputStyle.PARAGRAPH,
                custom_id: 'new_value',
                value: oldValue
              }
            ]
          }
        ]
      },
      (mctx) =>
        // Handled separately so we can use async/await without eslint complaining it wouldnt work because of argument types
        void this.handleModal(mctx, subcommand, oldValue, submission, updateFn)
    )
  }

  async handleModal (
    mctx: ModalInteractionContext,
    subcommand: string,
    oldValue: string,
    submission: ValidatedSubmission | PendingSubmission,
    updateFn: (val: string) => Promise<void> | void
  ): Promise<void> {
    const newValue = mctx.values.new_value
    logger.debug(
      `Setting ${subcommand} to ${newValue} from ${oldValue} on submission ${stringify.submission(
        submission
      )}`
    )

    // Wait for the update to complete
    // Rethrows because if we fail to update, we wont be able to validate below
    await runCatching(() => updateFn(newValue), 'rethrow')

    logger.trace('Set successfuly')

    // Already validated
    if (isValidated(submission)) {
      logger.trace('Submission already validated')

      await updateMessage(
        submission.submissionMessage,
        createEmbed(submission)
      )
      await updateThreadName(submission.reviewThread, submission.name)

      await mctx.send({
        content: `Updated the ${subcommand} successfuly`,
        ...DEFAULT_MESSAGE_OPTS_SLASH,
        ephemeral: false
      })
      return
    }

    logger.trace('Submission not validated, running validation')
    // Submission should be valid after calling updateFn
    const validated = await validatePendingSubmission(submission)
    await updateMessage(validated.submissionMessage, createEmbed(submission))
    await updateThreadName(validated.reviewThread, validated.name)
    await mctx.send({
      content: `Updated the ${subcommand} successfuly`,
      ...DEFAULT_MESSAGE_OPTS_SLASH,
      ephemeral: false
    })
  }
}
