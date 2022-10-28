import { APIEmbed, BaseMessageOptions } from 'discord.js'
import { MessageOptions } from 'slash-create'
import config from '../config'

export type LogLevel = 'info' | 'warning' | 'error'
export type LogType = 'embed' | 'text'

interface BaseLogOptions<TOpts, TCtx> {
  level: LogLevel
  type: LogType

  extraOpts?: TOpts
  ctx: TCtx
}

interface EmbedLogOptions<TOpts, TCtx> extends BaseLogOptions<TOpts, TCtx> {
  type: 'embed'

  embed: APIEmbed
}

interface TextLogOptions<TOpts, TCtx> extends BaseLogOptions<TOpts, TCtx> {
  type: 'text'

  content: string
}

export type InternalLogOptions<TOpts, TCtx> =
  | EmbedLogOptions<TOpts, TCtx>
  | TextLogOptions<TOpts, TCtx>

export type LogOptions<TOpts, TCtx> =
  | Omit<EmbedLogOptions<TOpts, TCtx>, 'level'>
  | Omit<TextLogOptions<TOpts, TCtx>, 'level'>

/**
 * Makes the discord.js message options for the given log options.
 * This will set the colour of the embed if applicable.
 */
export function makeDjsMessageOpts<TOpts> (
  options: InternalLogOptions<TOpts, unknown>
): BaseMessageOptions {
  let out

  if (options.type === 'embed') {
    const embed = { ...options.embed }
    embed.color = config.colours().log[options.level]

    out = {
      embeds: [embed],
      ...options.extraOpts
    }
  } else {
    out = {
      content: `${config.emojis().log[options.level]} ${options.content}`,
      ...options.extraOpts
    }
  }

  return out
}

/**
 * Makes the slash-create message options for the given log options.
 * This will set the colour of the embed if applicable.
 */
export function makeSlashMessageOpts<TOpts> (
  options: InternalLogOptions<TOpts, unknown>
): MessageOptions {
  let out

  if (options.type === 'embed') {
    const embed = { ...options.embed }
    embed.color = config.colours().log[options.level]

    out = {
      embeds: [embed],
      ...options.extraOpts
    }
  } else {
    out = {
      content: `${config.emojis().log[options.level]} ${options.content}`,
      ...options.extraOpts
    }
  }

  return out
}
