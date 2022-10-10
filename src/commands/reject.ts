import { TextBasedChannel } from 'discord.js'
import { Err, Ok, Result } from 'ts-results'
import { ProjectsClient } from '../client'
import { ValidRejectionKey } from '../config'
import { Command } from '../managers/commands'
import { Submission } from '../models/submission'
import { instantlyReject, submissionCleanup } from '../utils/actionVotes'
import { log } from '../utils/logger'
import { getRelevantSubmission, submissionNameAutocompleteProvider, submissionNameStringOption } from './utils'

const reject: Command = {
  name: 'reject',
  description: 'Instantly rejects a project with a preset reason',
  permissionLevel: 'staff',
  shouldPublishGlobally: true,
  configureBuilder: (builder, client) => {
    builder.addStringOption(str =>
      str.setName('reason')
        .setDescription('The reason to reject the project.')
        .setChoices(...client.config.rejectionDescriptions())
        .setRequired(true)
    )
      .addStringOption(submissionNameStringOption)
  },
  onAutocomplete: submissionNameAutocompleteProvider,
  run: async (client, interaction) => {
    const submissionRes = await getRelevantSubmission(client, interaction)

    if (submissionRes.err) {
      return Err(submissionRes.val)
    }

    if (!submissionRes.val) {
      // Errors are handled and reported above
      return Ok.EMPTY
    }

    const submission = submissionRes.val

    // Casting is OK, we control the data, we just have to ensure that the objects are alligned
    const reasonName = interaction.options.getString('reason', true) as ValidRejectionKey
    const rejectionTemplates = client.config.rejectionTemplates()

    const template = rejectionTemplates[reasonName]

    if (!template) {
      await interaction.reply({
        content: `Could not find corresponding template for reason ${reasonName}, please report this.`
      })

      return Ok.EMPTY
    }

    const reason = template({
      user: submission.author.id,
      name: submission.name
    })

    const didSendRejection = await sendPrivateFeedback(client, submission, reason, reasonName)

    if (!didSendRejection) {
      await interaction.reply({
        content: `Could not send rejection message for project ${submission.name}, please create the thread manually and send the message:\n\n\`${reason}\``
      })
    }

    // The last param forces the cleanup function to not run, as that would interfere with further messages we send to the channel
    // This is required because if we fail to send the rejection message, and the user has to do this manually
    // archiving the thread would make the message go away and would result in poor UX
    await instantlyReject(submission, interaction.user, reasonName, client, false)

    await client.submissions.update(submission)

    // Either reply if it's the first message, or follow up if it's the second
    await interaction[didSendRejection ? 'reply' : 'followUp']({
      // 'completed' because it might not have worked all the way, but we're done with it
      content: `Rejection completed for project: ${submission.name} with Reason ${reasonName}`
    })

    if (didSendRejection) {
      // Run cleanup now, if we managed to send the rejection message
      // otherwise, don't, as the user will need to keep the thread open to copy the message
      await submissionCleanup(submission, client, 'denied')
    }
    return Ok.EMPTY
  }
}

async function sendPrivateFeedback (client: ProjectsClient, submission: Submission, content: string, reason: ValidRejectionKey): Promise<boolean> {
  const { publicLog, publicFeedback } = client.config.channels()

  let channel: TextBasedChannel

  if (client.config.rejectionWhitelist().includes(reason)) {
    channel = publicLog
  } else {
    const channelRes = await Result.wrapAsync(async () => await publicFeedback.threads.create({
      name: submission.name,
      type: client.config.botSettings().threadPrivacy
    }))

    if (channelRes.err) {
      log.error('Failed to create private feedback thread')
      log.error(channelRes.val)

      return false
    }

    channel = channelRes.val
  }

  const messageRes = await Result.wrapAsync(async () =>
    await channel.send({
      content
    })
  )

  if (messageRes.err) {
    log.error('Failed to send messages to private feedback thread')
    log.error(messageRes.val)

    return false
  }

  return true
}
export default reject
