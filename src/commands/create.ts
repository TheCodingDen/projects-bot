import { Ok } from 'ts-results'
import handleIncomingSubmission from '../api/handleIncomingSubmission'
import { Command } from '../managers/commands'
import { IncomingSubmissionData } from '../models/schema/submission'

const create: Command = {
  name: 'create',
  description: 'Creates a project for testing',
  permissionLevel: 'veterans',
  configureBuilder: () => { },
  shouldPublishGlobally: false,
  run: async (client, interaction) => {
    const data: IncomingSubmissionData = {
      name: 'Testing project',
      description: 'A simple project for testing',
      tech: 'JS, TS',
      links: {
        source: 'https://github.com/TheCodingDen/projects-bot',
        other: 'None'
      },
      author: interaction.user.id
    }

    await interaction.deferReply({
      ephemeral: true
    })

    // Run the entire flow as if the data came from the API
    const res = await handleIncomingSubmission(data, client)

    if (res.err) {
      await interaction.editReply({
        content: `Something went wrong whilst creating the project ${JSON.stringify(res.val)}`
      })
    } else {
      await interaction.editReply({
        content: 'Created the project successfully!'
      })
    }

    return Ok.EMPTY
  }
}

export default create
