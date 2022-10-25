import { ChannelType } from 'discord.js'
import { SlashCommand, SlashCreator, CommandContext } from 'slash-create'
import { commandLog } from '../communication/interaction'
import config from '../config'
import {
  updateFeedbackThreadId,
  validatePendingSubmission
} from '../db/submission'
import { fetchSubmissionForContext } from '../utils/commands'
import { getAssignedGuilds } from '../utils/discordUtils'

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

    let existingThread

    if (submission.state === 'ERROR') {
      commandLog.warning(
        'Cannot create a thread for a project in an error state, please resolve the errors and retry.',
        ctx
      )
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
      await existingThread
        .send({ content: ctx.user.mention })
        .then(async (msg) => await msg.delete())
      commandLog.info(
        `Added you to existing thread <#${existingThread.id}>`,
        ctx
      )
      return
    }

    // Otherwise, make a thread
    const { publicShowcase } = config.channels()
    const feedbackThread = await publicShowcase.threads.create({
      name: submission.name,
      // This cannot be abstracted anywhere because we need to keep the union around
      type:
        process.env.NODE_ENV === 'production'
          ? ChannelType.PrivateThread
          : ChannelType.PublicThread
    })

    await updateFeedbackThreadId(submission, feedbackThread.id)

    await feedbackThread
      .send({ content: ctx.user.mention })
      .then(async (msg) => await msg.delete())

    commandLog.info(`Added you to new thread <#${feedbackThread.id}>`, ctx)
  }
}
