import assert from 'assert'
import {
  SlashCommand,
  SlashCreator,
  CommandContext,
  CommandOptionType,
  ComponentType,
  TextInputStyle,
  ButtonStyle
} from 'slash-create'
import { commandLog } from '../communication/interaction'
import { createDraft, deleteDraft } from '../db/draft'
import { Draft } from '../types/draft'
import { isValidated, ValidatedSubmission } from '../types/submission'
import { fetchSubmissionForContext } from '../utils/commands'
import { DEFAULT_MESSAGE_OPTS_SLASH } from '../utils/communication'
import { getAssignedGuilds } from '../utils/discordUtils'
import { runCatching } from '../utils/request'
import { stringify } from '../utils/stringify'

export default class DraftCommand extends SlashCommand {
  constructor (creator: SlashCreator) {
    super(creator, {
      name: 'draft',
      description: 'Manages draft rejection messages for a submission',
      guildIDs: getAssignedGuilds({ includeMain: true }),
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'add',
          description: 'Updates the current draft for a submission'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'clear',
          description: 'Clears the current draft for a submission'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'view',
          description: 'Views the current draft for a submission'
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'history',
          description: 'Views the draft history for a submission'
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

    if (!isValidated(submission)) {
      commandLog.warning({
        type: 'text',
        content:
          'Cannot use drafts on a pending or paused submission, please resolve issues and retry.',
        ctx
      })
      return
    }

    switch (subcommand) {
      case 'add':
        await this.addNewDraft(ctx, submission)
        return
      case 'view':
        await this.viewCurrentDraft(ctx, submission)
        return
      case 'clear':
        await this.clearCurrentDraft(ctx, submission)
        return
      case 'history':
        await this.viewDraftHistory(ctx, submission)
    }
  }

  async viewDraftHistory (
    ctx: CommandContext,
    submission: ValidatedSubmission
  ): Promise<void> {
    const drafts = submission.drafts.reverse()
    let currentIdx = 0

    if (!drafts.length) {
      commandLog.error({
        type: 'text',
        content: 'No draft set.',
        ctx
      })
      return
    }

    const generateDraftString = (draft: Draft): string => {
      return `
${draft.content}

id: ${draft.id}
author: ${draft.author.user.tag}
timestamp: ${draft.timestamp.toLocaleString()}
      `
    }

    await ctx.send({
      content: generateDraftString(drafts[0]),
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              custom_id: 'previous',
              label: 'Previous',
              style: ButtonStyle.PRIMARY
            },
            {
              type: ComponentType.BUTTON,
              custom_id: 'clear',
              label: 'Clear',
              style: ButtonStyle.DESTRUCTIVE
            },
            {
              type: ComponentType.BUTTON,
              custom_id: 'next',
              label: 'Next',
              style: ButtonStyle.PRIMARY
            }
          ]
        }
      ]
    })

    const message = await ctx.fetch()

    ctx.registerComponentFrom(message.id, 'previous', (bctx) => {
      if (currentIdx === 0) {
        // Skip to last
        currentIdx = drafts.length - 1
      } else {
        currentIdx -= 1
      }

      void runCatching(async () => {
        await bctx.acknowledge()

        await message.edit({
          content: generateDraftString(drafts[currentIdx]),
          ...DEFAULT_MESSAGE_OPTS_SLASH
        })
      }, 'rethrow')
    })

    ctx.registerComponentFrom(message.id, 'next', (bctx) => {
      if (currentIdx === drafts.length - 1) {
        // Skip to front
        currentIdx = 0
      } else {
        currentIdx += 1
      }

      void runCatching(async () => {
        await bctx.acknowledge()

        await message.edit({
          content: generateDraftString(drafts[currentIdx]),
          ...DEFAULT_MESSAGE_OPTS_SLASH
        })
      }, 'rethrow')
    })

    ctx.registerComponentFrom(message.id, 'clear', () => {
      void runCatching(async () => await message.delete(), 'rethrow')
    })
  }

  async clearCurrentDraft (
    ctx: CommandContext,
    submission: ValidatedSubmission
  ): Promise<void> {
    // TODO: confirmation?

    const hasDraft = submission.drafts.length > 0

    if (!hasDraft) {
      commandLog.error({
        type: 'text',
        content: 'No draft set.',
        ctx
      })
      return
    }

    const id = submission.drafts[0].id
    await deleteDraft(id)

    commandLog.info({
      type: 'text',
      content: `Deleted draft ${id}.`,
      ctx
    })
  }

  async addNewDraft (
    ctx: CommandContext,
    submission: ValidatedSubmission
  ): Promise<void> {
    const oldValue =
      submission.drafts[0]?.content ??
      `<@${submission.authorId}>, unfortunately, your project has been rejected.`

    await ctx.sendModal(
      {
        title: 'Draft rejection message',
        components: [
          {
            type: ComponentType.ACTION_ROW,
            components: [
              {
                type: ComponentType.TEXT_INPUT,
                label: 'Draft',
                style: TextInputStyle.PARAGRAPH,
                custom_id: 'newValue',
                value: oldValue
              }
            ]
          }
        ]
      },
      (mctx) => {
        const { newValue } = mctx.values
        logger.debug(
          `Adding draft ${newValue} to submission ${stringify.submission(
            submission
          )}`
        )

        void createDraft(newValue, mctx.user.id, submission.id)

        void runCatching(
          async () => {
            await mctx.send({
              content: 'Added new draft successfully.'
            })

            await mctx.sendFollowUp({
              content: newValue
            })
          },
          'rethrow'
        )
      }
    )
  }

  async viewCurrentDraft (
    ctx: CommandContext,
    submission: ValidatedSubmission
  ): Promise<void> {
    const current = submission.drafts[0]

    if (!current) {
      commandLog.error({
        type: 'text',
        content: 'No draft set.',
        ctx
      })
      return
    }

    commandLog.info({
      type: 'text',
      content: `
${current.content}

id: ${current.id}
author: ${current.author.user.tag}
timestamp: <t:${current.timestamp.getUTCMilliseconds()}:f> (<t:${current.timestamp.getUTCMilliseconds()}:R>)
`,
      ctx,
      extraOpts: {
        ephemeral: false
      }
    })
  }
}
