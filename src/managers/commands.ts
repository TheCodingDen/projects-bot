import { SlashCommandBuilder } from '@discordjs/builders'
import { REST } from '@discordjs/rest'
import { AutocompleteInteraction, Awaitable, CommandInteraction, Interaction, ModalSubmitInteraction, Snowflake } from 'discord.js'
import { Manager } from '.'
import { ProjectsClient } from '../client'
import { commands } from '../commands'
import { log } from '../utils/logger'
import { Routes } from 'discord-api-types/v9'
import { isStaff, isVeteran } from '../utils/member'
import { Result } from 'ts-results'
import { Submission } from '../models/submission'
import { getCustomIdAdapters } from '../utils/custom-id'

const { from: fromCustomId } = getCustomIdAdapters()

export type PermissionLevel = 'veterans' | 'staff'

export interface Command {
  name: string
  description: string
  permissionLevel: PermissionLevel
  configureBuilder: (builder: SlashCommandBuilder, client: ProjectsClient) => Awaitable<void>

  run: (client: ProjectsClient, interaction: CommandInteraction<'cached'>) => Awaitable<Result<void, Error>>
  onAutocomplete?: (client: ProjectsClient, interaction: AutocompleteInteraction<'cached'>) => Awaitable<Result<void, Error>>
  onModalSubmit?: (client: ProjectsClient, interaction: ModalSubmitInteraction<'cached'>, submission: Submission) => Awaitable<Result<void, Error>>

  shouldPublishGlobally: boolean
}

type BuiltSlashCommand = ReturnType<SlashCommandBuilder['toJSON']>

// TODO: move this into a config or something
const shouldRegister = false

export class CommandsManager extends Manager {
  private hasLoadedCommands = false
  private readonly commands = new Map<string, Command>()

  init (): void {
    log.debug('Initialising slash commands')
    if (this.hasLoadedCommands) {
      // Saves stops useless writes to the cache and probable bugs
      log.warn('Attempted to load commands more than once')
      return
    }

    this.client.on('interactionCreate', this.onInteractionCreate.bind(this))
    this.loadCommands()
  }

  private loadCommands (): void {
    log.debug(`Loading ${this.commands.size} slash commands from file`)

    for (const command of commands) {
      if (this.commands.has(command.name)) {
        log.warn(`Attempted to register already registered command ${command.name}`)
        continue
      }

      this.commands.set(command.name, command)
      log.debug(`Registered command ${command.name}`)
    }

    log.debug('Finished loading of slash commands')
    this.hasLoadedCommands = true
  }

  get (name: string): Command | undefined {
    return this.commands.get(name)
  }

  async registerCommands (): Promise<void> {
    log.info(`Registering ${this.commands.size} slash commands with Discord`)

    if (!shouldRegister) {
      log.info('Registration disabled, halting')
      return
    }

    if (!this.hasLoadedCommands || this.commands.size === 0) {
      log.warn('Attempted to register commands before loading, or the map was empty')
      return
    }

    const clientId = this.client.user?.id

    if (!clientId) {
      log.warn('Attempted to register commands before the client was ready. No commands will be set.')
      return
    }

    const rest = new REST({ version: '9' }).setToken(this.client.config.botSettings().token)
    const commands = [...this.commands.values()]

    const guildCommands = new Map<Snowflake, BuiltSlashCommand[]>()
    const globalCommands: BuiltSlashCommand[] = []
    const testingGuild = this.client.config.guilds().testing

    for (const command of commands) {
      const builder = new SlashCommandBuilder()

      builder.setName(command.name)
        .setDescription(command.description)

      if (this.client.config.nodeEnv() === 'development') {
        // In development environments, default all commands to be registered to the testing guild; this
        // allows us to actually refresh more often than once per hour.

        await command.configureBuilder(builder, this.client)

        const cmds = guildCommands.get(testingGuild.id) ?? []
        cmds.push(builder.toJSON())

        guildCommands.set(testingGuild.id, cmds)
      } else if (command.shouldPublishGlobally) {
        // Otherwise, go global
        // Our commands dont support DMs
        builder.setDMPermission(false)

        await command.configureBuilder(builder, this.client)

        globalCommands.push(builder.toJSON())
      }
    }

    for (const [guildId, commandsForGuild] of guildCommands) {
      log.debug(`Registering ${commandsForGuild.length} commmands for guild ${guildId} (${JSON.stringify(commandsForGuild)})`)

      const apiRes = await Result.wrapAsync(async () =>
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commandsForGuild }
        )
      )

      if (apiRes.err) {
        log.error(`Failed to register commands for guild ${guildId} due to API error`)
        log.error(apiRes.val)
      }
    }
    const apiRes = await Result.wrapAsync(async () =>
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: globalCommands }
      )
    )

    if (apiRes.err) {
      log.error('Failed to register global commands due to API error')
      log.error(apiRes.val)
    }

    log.info(`Registered ${globalCommands.length} global commands and ${guildCommands.size} sets of commands in guilds.`)
  }

  private async onInteractionCreate (interaction: Interaction): Promise<void> {
    // Checks if we have this guild cached too, which should always be true
    // As we are not using HTTP interactions
    if (!interaction.inCachedGuild()) {
      // Just ignore them, this shouldn't happen anyways
      // as we set this option to false when we register the commands

      // Warn just in case, so we don't fail silently
      log.warn('Received an interaction in DMs? This should never happen.')
      return
    }

    if (interaction.isCommand()) {
      await this.handleCommand(interaction)
    } else if (interaction.isAutocomplete()) {
      await this.handleAutocomplete(interaction)
    } else if (interaction.isModalSubmit()) {
      await this.handleModalSubmit(interaction)
    }
  }

  private async handleModalSubmit (interaction: ModalSubmitInteraction<'cached'>): Promise<void> {
    const idRes = fromCustomId(interaction.customId)

    if (idRes.err) {
      log.error(`Interaction was provided with invalid customId \`${interaction.customId}\``)
      log.error(idRes.err)

      throw idRes.val
    }

    const { name: commandName, id: submissionId } = idRes.val

    const cmd = this.commands.get(commandName)

    if (!cmd) {
      log.warn(`Got modal submit interaction for unknown command ${commandName}`)
      return
    }

    const submissionRes = await this.client.submissions.fetch(submissionId)

    if (submissionRes.err) {
      // As noted, this should never happen. We should log it anyways though
      log.error(`Failed to fetch submission with ID ${submissionId}? This should not happen.`)
      log.error(submissionRes.val)

      return
    }

    const cbRes = await Result.wrapAsync(async () => await cmd.onModalSubmit?.(this.client, interaction, submissionRes.val))

    if (cbRes.err) {
      log.error(`Encountered error while executing modal submit for command ${commandName}`)
      log.error(cbRes.val)
    }
  }

  private async handleAutocomplete (interaction: AutocompleteInteraction<'cached'>): Promise<void> {
    const cmd = this.commands.get(interaction.commandName)

    if (!cmd) {
      log.warn(`Got autocomplete interaction for unknown command ${interaction.commandName}`)
      return
    }

    const cbRes = await Result.wrapAsync(async () => await cmd.onAutocomplete?.(this.client, interaction))

    if (cbRes.err) {
      log.error(`Encountered error while executing autocomplete for command ${interaction.commandName}`)
      log.error(cbRes.val)
    }
  }

  private async handleCommand (interaction: CommandInteraction<'cached'>): Promise<void> {
    if (this.commands.size === 0) {
      // Don't abort, we're going to report unknown command anyways
      log.warn(`When attempting to run commands, the map was empty? Was init() called? hasLoadedCommands=${this.hasLoadedCommands}`)
    }

    const cmd = this.commands.get(interaction.commandName)

    if (!cmd) {
      // This would only happen if we forgot to register a command in some way
      // So it is safe to transmit before permission checks
      log.warn(`Got interaction for unknown command ${interaction.commandName}, was it registered in the commands array?`)
      await interaction.reply({
        content: 'Sorry, that command was not recognised, please report this.',
        ephemeral: true
      })

      return
    }

    let canExecute

    if (isStaff(interaction.member, this.client)) {
      // Staff can always execute anything
      canExecute = true
    } else if (isVeteran(interaction.member, this.client)) {
      if (cmd.permissionLevel === 'veterans') {
        // If the perm level is vet, they are allowed
        canExecute = true
      } else {
        // Otherwise, they cannot
        canExecute = false
      }
    } else {
      // Not staff or vet, completely disallowed
      canExecute = false
    }

    if (!canExecute) {
      await interaction.reply({
        content: 'Sorry, you do not have permission to execute that command.',
        ephemeral: true
      })

      return
    }

    const cmdRes = await Result.wrapAsync(async () => await cmd.run(this.client, interaction))

    if (cmdRes.err) {
      log.error(`Unexpected error during execution of command ${cmd.name}`)
      log.error(cmdRes.val)

      await Result.wrapAsync(async () =>
        await interaction.followUp({
          content: 'That command threw an unexpected error whilst executing, please report this.',
          ephemeral: true
        })
      )
    }
  }
}
