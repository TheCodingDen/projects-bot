import { CommandInteraction, MessageActionRow, Modal, ModalSubmitInteraction, TextInputComponent } from 'discord.js'
import { Ok, Err, Result } from 'ts-results'
import { Command } from '../managers/commands'
import { Submission } from '../models/submission'
import { assert } from '../utils/assert'
import { embeds } from '../utils/embeds'
import { getRelevantSubmission, submissionNameAutocompleteProvider, submissionNameStringOption } from './utils'

const edit: Command = {
  name: 'edit',
  description: 'Edits the title, description, or links of a submission.',
  permissionLevel: 'veterans',
  shouldPublishGlobally: true,
  configureBuilder: builder => {
    builder.addSubcommand(cmd =>
      cmd.setName('name')
        .setDescription('Edits the name of the submission')
        .addStringOption(submissionNameStringOption)
    )

    builder.addSubcommand(cmd =>
      cmd.setName('description')
        .setDescription('Edits the description of the submission')
        .addStringOption(submissionNameStringOption)
    )

    builder.addSubcommand(cmd =>
      cmd.setName('source')
        .setDescription('Edits the source link of the submission')
        .addStringOption(submissionNameStringOption)
    )

    builder.addSubcommand(cmd =>
      cmd.setName('other')
        .setDescription('Edits the other links of the submission')
        .addStringOption(submissionNameStringOption)
    )

    builder.addSubcommand(cmd =>
      cmd.setName('technologies')
        .setDescription('Edits the technologies of the submission')
        .addStringOption(submissionNameStringOption)
    )
  },
  onAutocomplete: submissionNameAutocompleteProvider,
  onModalSubmit: async (client, interaction, submission) => {
    const newData = interaction.fields.getTextInputValue('newData')
    const type = extractType(interaction)

    submission.updateValue(type, newData)

    const updateRes = await client.submissions.update(submission)

    if (updateRes.err) {
      await interaction.reply({
        content: 'Failed to save the new content to the DB, please try again.',
        ephemeral: true
      })

      return Ok.EMPTY
    }

    const messageRes = await Result.wrapAsync(async () => await submission.message.edit({
      // 'toIncoming' produces an object of type 'IncomingSubmissionData' which 'privateSubmission' needs
      // this object would be tedious to construct at every usage
      // this has to happen because the private submission must be available before a model is available
      embeds: [embeds.privateSubmission(submission.toIncoming(), submission.author)]
    }))

    if (messageRes.err) {
      await interaction.reply({
        content: 'Failed to edit the submission embed, please try again.',
        ephemeral: true
      })

      return Ok.EMPTY
    }

    await interaction.reply({
      content: `Edited the ${type} succesfully!`
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

    // Proceed with edit
    await doEdit(submission.val, interaction)

    return Ok.EMPTY
  }
}

function extractType (interaction: ModalSubmitInteraction<'cached'>): 'name' | 'description' | 'source' | 'other' | 'technologies' {
  const [,,type] = interaction.customId.split('|')

  // Casting is OK, we control the types
  return type as 'name' | 'description' | 'source' | 'other' | 'technologies'
}

function makeModal (submission: Submission, type: 'name' | 'description' | 'source' | 'other' | 'technologies'): Modal {
  const existingData = {
    name: () => submission.name,
    description: () => submission.description,
    source: () => submission.links.source,
    other: () => submission.links.other,
    technologies: () => submission.techUsed
  }[type]()

  return new Modal()
    .setTitle(`Edit ${type}`)
    .setCustomId(`edit|${submission.id}|${type}`)
    .addComponents(
      new MessageActionRow<TextInputComponent>()
        .addComponents(
          new TextInputComponent()
            .setLabel(`New ${type}`)
            .setCustomId('newData')
            .setRequired(true)
            .setValue(existingData)
            .setStyle('PARAGRAPH')
        )
    )
}

async function doEdit (submission: Submission, interaction: CommandInteraction<'cached'>): Promise<void> {
  assert(interaction.channel !== null, 'interaction came without a channel')

  // Casting is OK, we control the types
  const type = interaction.options.getSubcommand(true) as 'name' | 'description' | 'source' | 'other' | 'technologies'

  await interaction.showModal(makeModal(submission, type))
}

export default edit
