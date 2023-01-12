import assert from 'assert'
import { Interaction, InteractionReplyOptions } from 'discord.js'
import { CommandContext, MessageOptions } from 'slash-create'
import {
  DEFAULT_MESSAGE_OPTS_DJS,
  DEFAULT_MESSAGE_OPTS_SLASH
} from '../utils/communication'
import { runCatching } from '../utils/request'
import {
  InternalLogOptions,
  LogOptions,
  makeDjsMessageOpts,
  makeSlashMessageOpts
} from './opts'

function genericInteractionLog (
  options: InternalLogOptions<InteractionReplyOptions, Interaction>
): void {
  const interaction = options.ctx
  assert(interaction.isRepliable(), 'Interaction was not repliable.')

  if (interaction.replied) {
    void runCatching(
      async () =>
        await interaction.followUp({
          ...makeDjsMessageOpts(options),
          ...DEFAULT_MESSAGE_OPTS_DJS
        }),
      'rethrow'
    )
  } else if (interaction.deferred) {
    void runCatching(
      async () =>
        await interaction.followUp({
          ...makeDjsMessageOpts(options),
          ...DEFAULT_MESSAGE_OPTS_DJS
        }),
      'rethrow'
    )
  } else {
    void runCatching(
      async () =>
        await interaction.reply({
          ...makeDjsMessageOpts(options),
          ...DEFAULT_MESSAGE_OPTS_DJS
        }),
      'rethrow'
    )
  }
}

function genericCommandLog (
  options: InternalLogOptions<MessageOptions, CommandContext>
): void {
  void runCatching(
    async () =>
      await options.ctx.send({
        ...makeSlashMessageOpts(options),
        ...DEFAULT_MESSAGE_OPTS_SLASH
      }),
    'rethrow'
  )
}

export const interactionLog = {
  info: (options: LogOptions<InteractionReplyOptions, Interaction>) =>
    genericInteractionLog({ ...options, level: 'info' }),
  warning: (options: LogOptions<InteractionReplyOptions, Interaction>) =>
    genericInteractionLog({ ...options, level: 'warning' }),
  error: (options: LogOptions<InteractionReplyOptions, Interaction>) =>
    genericInteractionLog({ ...options, level: 'error' })
}

export const commandLog = {
  info: (options: LogOptions<MessageOptions, CommandContext>) =>
    genericCommandLog({ ...options, level: 'info' }),
  warning: (options: LogOptions<MessageOptions, CommandContext>) =>
    genericCommandLog({ ...options, level: 'warning' }),
  error: (options: LogOptions<MessageOptions, CommandContext>) =>
    genericCommandLog({ ...options, level: 'error' })
}
