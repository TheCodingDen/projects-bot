import { CommandInteraction } from 'discord.js'
import { ProjectsClient } from '../client'
import config from '../config'
import { Command } from '../managers/commands'
import { embeds } from '../utils/embeds'
import { Ok } from 'ts-results'

const help: Command = {
  name: 'help',
  description: 'Displays help for the bot, or a given command',
  permissionLevel: 'veterans',
  shouldPublishGlobally: true,
  configureBuilder: builder => {
    builder.addStringOption(str =>
      str.setName('command')
        .setDescription('The command to display help for')
        .setRequired(false)
        .setChoices(...Object.keys(config.help.commands).map(cmd => ({ name: cmd, value: cmd })))
    )
  },
  run: async (client, interaction) => {
    const commandName = interaction.options.getString('command')

    if (!commandName) {
      await doRegularHelp(client, interaction)
    } else {
      await doCommandHelp(commandName, client, interaction)
    }

    return Ok.EMPTY
  }
}

async function doRegularHelp (_client: ProjectsClient, interaction: CommandInteraction<'cached'>): Promise<void> {
  return await interaction.reply({
    embeds: [embeds.generalHelp()],
    ephemeral: true
  })
}

async function doCommandHelp (commandName: string, client: ProjectsClient, interaction: CommandInteraction<'cached'>): Promise<void> {
  const command = client.commands.get(commandName)

  if (!command) {
    return await interaction.reply({
      content: `Sorry, command \`${commandName}\` does not exist`,
      ephemeral: true
    })
  }

  return await interaction.reply({ embeds: [embeds.commandHelp(command)] })
}
export default help
