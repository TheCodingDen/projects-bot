import { Message } from 'discord.js'
import { Err, Ok, Result } from 'ts-results'
import { Command } from '../managers/commands'
import { submissionCleanup } from '../utils/actionVotes'
import { getRelevantSubmission, submissionNameAutocompleteProvider, submissionNameStringOption } from './utils'

const cleanup: Command = {
  name: 'cleanup',
  description: 'Cleans up a project. Removes log messages, archives the thread and deletes the submission message.',
  permissionLevel: 'staff',
  configureBuilder: builder => {
    builder.addStringOption(submissionNameStringOption)
  },
  onAutocomplete: submissionNameAutocompleteProvider,
  shouldPublishGlobally: false,
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

    const deferRes = await Result.wrapAsync(async () => await interaction.deferReply({
      ephemeral: true
    }))

    if (deferRes.err) {
      return Err(deferRes.val as Error)
    }

    submission.setDeleted()

    const dbRes = await client.submissions.update(submission)

    if (dbRes.err) {
      return Err(dbRes.val)
    }

    // This never throws, and errors are handled in it
    await submissionCleanup(submission, client, 'cleanup')

    const res = await Result.wrapAsync<Message, Error>(async () => await interaction.editReply({
      content: `Cleaned up ${submission.name}`
    }))

    if (res.err) {
      return Err(res.val)
    }

    return Ok.EMPTY
  }
}

export default cleanup
