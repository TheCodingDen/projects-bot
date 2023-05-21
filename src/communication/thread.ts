import { BaseMessageOptions, TextBasedChannel, ThreadChannel } from 'discord.js'
import { DEFAULT_MESSAGE_OPTS_DJS } from '../utils/communication'
import { runCatching } from '../utils/request'
import { InternalLogOptions, LogOptions, makeDjsMessageOpts } from './opts'

// Unioned because d.js does not consider threads 'text based' for whatever reason...
type SendableChannel = TextBasedChannel | ThreadChannel

function doLog (
  options: InternalLogOptions<
  BaseMessageOptions,
  SendableChannel
  >
): void {
  void runCatching(
    async () =>
      await options.ctx.send({
        ...DEFAULT_MESSAGE_OPTS_DJS,
        ...makeDjsMessageOpts(options)
      }),
    'rethrow'
  )
}

export const genericLog = {
  info: (
    options: LogOptions<
    BaseMessageOptions,
    SendableChannel
    >
  ) => doLog({ ...options, level: 'info' }),
  warning: (
    options: LogOptions<
    BaseMessageOptions,
    SendableChannel
    >
  ) => doLog({ ...options, level: 'warning' }),
  error: (
    options: LogOptions<
    BaseMessageOptions,
    SendableChannel
    >
  ) => doLog({ ...options, level: 'error' })
}
