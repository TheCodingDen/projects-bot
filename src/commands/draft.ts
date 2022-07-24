
import { CommandInteraction, MessageActionRow, Modal, TextInputComponent } from 'discord.js'
import { Err, Ok, Result } from 'ts-results'
import { Command } from '../managers/commands'
import { Submission } from '../models/submission'
import { assert } from '../utils/assert'
import { getCustomIdAdapters } from '../utils/custom-id'
import { getRelevantSubmission, submissionNameAutocompleteProvider, submissionNameStringOption } from './utils'

const { from: fromCustomId, to: toCustomId } = getCustomIdAdapters()

const draft: Command = {
  name: 'draft',
  description: 'Controls draft rejection messages for a project',
  permissionLevel: 'veterans',
  configureBuilder: builder => {
    builder.addSubcommand(cmd =>
      cmd.setName('create')
        .setDescription('Creates a new draft for a project')
        .addStringOption(submissionNameStringOption)
    )

    builder.addSubcommand(cmd =>
      cmd.setName('show')
        .setDescription('Show the latest draft for a project')
        .addStringOption(submissionNameStringOption)
    )
  },
  shouldPublishGlobally: true,
  onAutocomplete: submissionNameAutocompleteProvider,
  onModalSubmit: async (client, interaction) => {
    const idRes = fromCustomId(interaction.customId)

    if (idRes.err) {
      return Err(idRes.val)
    }

    const { id: submissionId } = idRes.val

    const submissionRes = await client.submissions.fetch(submissionId)

    if (submissionRes.err) {
      await interaction.reply({
        content: 'Something went wrong when trying to update the draft, please try again.',
        ephemeral: true
      })
      return Err(submissionRes.val)
    }

    const submission = submissionRes.val
    const draft = interaction.fields.getTextInputValue('draft')

    // Because we use a DB generated ID, this function pushes the value to the DB
    // and then updates our model, so we do not have to call for an update afterwards
    await submission.drafts.push(draft)

    await interaction.reply({
      content: 'Added the draft successfully!'
    })

    return Ok.EMPTY
  },
  run: async (client, interaction) => {
    const submission = await getRelevantSubmission(client, interaction)

    if (submission.err) {
      return Err(submission.val)
    }

    if (!submission.val) {
      // Errors are handled and reported above
      return Ok.EMPTY
    }

    const subCommand = interaction.options.getSubcommand(true)

    if (subCommand === 'create') {
      return await createDraft(submission.val, interaction)
    } else if (subCommand === 'show') {
      return await showDraft(submission.val, interaction)
    }

    assert(false, `unrecognised subcommand ${subCommand}`)
  }
}

function makeModal (submission: Submission): Modal {
  const currentDraft = submission.drafts.currentDraft()?.content ?? `<@${submission.author.id}>, unfortunately your project has been rejected. `

  return new Modal()
    .setTitle(`Submit a new draft for ${submission.name}`)
    .setCustomId(toCustomId({ name: 'draft', id: submission.id }))
    .addComponents(
      new MessageActionRow<TextInputComponent>()
        .addComponents(
          new TextInputComponent()
            .setLabel('Draft')
            .setCustomId('draft')
            .setRequired(true)
            .setValue(currentDraft)
            .setStyle('PARAGRAPH')
        )
    )
}

async function showDraft (submission: Submission, interaction: CommandInteraction<'cached'>): Promise<Result<void, Error>> {
  const draft = submission.drafts.currentDraft() ?? { content: 'None', id: 0 }
  const content =
`
**Current draft:**

${draft.content}


__Draft ID: ${draft.id}__
`

  await interaction.reply({
    content
  })
  return Ok.EMPTY
}

async function createDraft (submission: Submission, interaction: CommandInteraction<'cached'>): Promise<Result<void, Error>> {
  await interaction.showModal(makeModal(submission))
  return Ok.EMPTY
}

export default draft
