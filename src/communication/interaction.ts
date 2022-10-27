import assert from 'assert'
import { Interaction, InteractionReplyOptions } from 'discord.js'
import { CommandContext, MessageOptions } from 'slash-create'
import config from '../config'
import { DEFAULT_MESSAGE_OPTS_DJS, DEFAULT_MESSAGE_OPTS_SLASH } from '../utils/communication'
import { runCatching } from '../utils/request'

function genericInteractionLog (
  message: string,
  interaction: Interaction,
  opts?: InteractionReplyOptions
): void {
  assert(interaction.isRepliable(), 'Interaction was not repliable.')

  if (interaction.replied) {
    void runCatching(async () =>
      await interaction.followUp({
        content: message,
        ...DEFAULT_MESSAGE_OPTS_DJS,
        ...opts
      })
    )
  } else {
    void runCatching(async () =>
      await interaction.reply({
        content: message,
        ...DEFAULT_MESSAGE_OPTS_DJS,
        ...opts
      })
    )
  }
}

function genericCommandLog (message: string, ctx: CommandContext, opts?: MessageOptions): void {
  void runCatching(async () =>
    await ctx.send({
      content: message,
      ...DEFAULT_MESSAGE_OPTS_SLASH,
      ...opts
    })
  )
}

const emojis = config.emojis().log
export const interactionLog = {
  info: (message: string, interaction: Interaction, opts?: InteractionReplyOptions) =>
    genericInteractionLog(`${emojis.info} ${message}`, interaction, opts),
  warning: (message: string, interaction: Interaction, opts?: InteractionReplyOptions) =>
    genericInteractionLog(`${emojis.warning} ${message}`, interaction, opts),
  error: (message: string, interaction: Interaction, opts?: InteractionReplyOptions) =>
    genericInteractionLog(`${emojis.error} ${message}`, interaction, opts)
}

export const commandLog = {
  info: (message: string, ctx: CommandContext, opts?: MessageOptions) =>
    genericCommandLog(`${emojis.info} ${message}`, ctx, opts),
  warning: (message: string, ctx: CommandContext, opts?: MessageOptions) =>
    genericCommandLog(`${emojis.warning} ${message}`, ctx, opts),
  error: (message: string, ctx: CommandContext, opts?: MessageOptions) =>
    genericCommandLog(`${emojis.error} ${message}`, ctx, opts)
}
