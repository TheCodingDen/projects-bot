import { ChannelType, ThreadChannel } from 'discord.js'
import { SlashCommand, SlashCreator, CommandContext } from 'slash-create'
import { commandLog } from '../communication/interaction'
import config from '../config'
import {
  updateFeedbackThreadId,
  validatePendingSubmission
} from '../db/submission'
import { fetchSubmissionForContext } from '../utils/commands'
import { getAssignedGuilds } from '../utils/discordUtils'
import { runCatching } from '../utils/request'

export default class ThreadCommand extends SlashCommand {
  constructor (creator: SlashCreator) {
    super(creator, {
      name: 'thread',
      description:
        'Create an empty feedback thread, or add the caller to an existing one.',
      guildIDs: getAssignedGuilds({ includeMain: true })
    })
  }

  async run (ctx: CommandContext): Promise<void> {
    const submission = await fetchSubmissionForContext(ctx)

    if (!submission) {
      return
    }

    let existingThread: ThreadChannel | undefined

    if (submission.state === 'ERROR') {
      commandLog.warning({
        type: 'text',
        content:
          'Cannot create a thread for a project in an error state, please resolve the errors and retry.',
        ctx
      })
      return
    }

    if (submission.state === 'PROCESSING' || submission.state === 'PAUSED') {
      // Allow thread creation in paused state, as reviewers may need to contact submitters about warnings
      existingThread = submission.feedbackThread
    }

    if (submission.state === 'WARNING') {
      // Allow thread creation in warning state, as reviewers may need to contact submitters about warnings
      const validated = await validatePendingSubmission(submission)

      existingThread = validated.feedbackThread
    }

    if (existingThread) {
      // Add caller to existing thread
      await runCatching(
        async () =>
          // SAFE: we checked it above
          // TS cant infer because of the callback here
          await (existingThread as ThreadChannel)
            .send({ content: ctx.user.mention })
            .then(async (msg) => await msg.delete()),
        'rethrow'
      )

      commandLog.info({
        type: 'text',
        content: `Added you to existing thread <#${existingThread.id}>`,
        ctx
      })
      return
    }

    // Otherwise, make a thread
    const { feedbackThreadChannel } = config.channels()
    const feedbackThread = await runCatching(
      async () =>
        await feedbackThreadChannel.threads.create({
          name: submission.name,
          // This cannot be abstracted anywhere because we need to keep the union around
          type:
            process.env.NODE_ENV === 'production'
              ? ChannelType.PrivateThread
              : ChannelType.PublicThread
        }),
      'rethrow'
    )
    await updateFeedbackThreadId(submission, feedbackThread.id)

    await runCatching(
      async () =>
        await feedbackThread
          .send({ content: ctx.user.mention })
          .then(async (msg) => await msg.delete()),
      'suppress'
    )

    commandLog.info({
      type: 'text',
      content: `Added you to new thread <#${feedbackThread.id}>`,
      ctx
    })
  }
}
