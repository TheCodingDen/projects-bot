import { SlashCommandStringOption } from '@discordjs/builders'
import { AutocompleteInteraction, CommandInteraction } from 'discord.js'
import { Err, Ok, Result } from 'ts-results'
import { ProjectsClient } from '../client'
import { Submission } from '../models/submission'
import { assert } from '../utils/assert'
import { log } from '../utils/logger'

export function submissionNameStringOption (str: SlashCommandStringOption): SlashCommandStringOption {
  return str.setName('submission-name')
    .setDescription('Use the provided submission instead of automatically detecting one')
    .setAutocomplete(true)
}

export async function submissionNameAutocompleteProvider (client: ProjectsClient, interaction: AutocompleteInteraction<'cached'>): Promise<Result<void, Error>> {
  const submissions = await client.submissions.underReview()

  if (submissions.err) {
    return Err(submissions.val)
  }
  const currentValue = interaction.options.getFocused(true)
  // Cast is OK because we set the values, so we know it's a string
  const filtered = submissions.val.filter(s => s.name.toLowerCase().startsWith(currentValue.value))

  await interaction.respond(
    filtered.map(s => ({ name: s.name, value: s.id }))
  )

  return Ok.EMPTY
}

export async function getRelevantSubmission (client: ProjectsClient, interaction: CommandInteraction<'cached'>): Promise<Result<Submission | undefined, Error>> {
  const selectedSubmission = interaction.options.getString('submission-name')

  if (selectedSubmission) {
    // User selected a different submission, which we know is valid

    const submission = await client.submissions.fetch(selectedSubmission)

    if (!submission) {
      await interaction.reply({
        content: `Something went wrong, I could not resolve a submission with the ID ${selectedSubmission}.`,
        ephemeral: true
      })

      return Ok(undefined)
    }

    return submission
  } else {
    // Get current thread and look up based on that associated ID

    const channel = interaction.channel

    assert(channel !== null, 'interaction came without a channel')

    if (!channel.isThread()) {
      await interaction.reply({
        content: `Could not find a submission associated to this channel (${channel.id})`
      })

      return Ok(undefined)
    }

    const res = await client.submissions.fetchByThreadId(channel.id)

    if (res.err) {
      log.error(`Could not fetch submission thread for channel ${channel.id}`)
      log.error(res.val)

      return Err(res.val)
    }

    if (!res.val) {
      await interaction.reply({
        content: `Could not find a submission associated to this thread (${channel.id})`
      })

      return Ok(undefined)
    }

    return Ok(res.val)
  }
}
