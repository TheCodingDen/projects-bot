import { BaseMessageOptions } from 'discord.js'
import config from '../config'
import { PendingSubmission, ValidatedSubmission } from '../types/submission'
import { DEFAULT_MESSAGE_OPTS_DJS } from '../utils/communication'
import { runCatching } from '../utils/request'
import { InternalLogOptions, LogOptions, makeDjsMessageOpts } from './opts'

function genericLog (
  options: InternalLogOptions<
  BaseMessageOptions,
  PendingSubmission | ValidatedSubmission
  >
): void {
  if (options.type === 'text') {
    options.content += `(Submission: ${options.ctx.name})`
  }

  void runCatching(
    async () =>
      await config.channels().publicLogs.send({
        ...makeDjsMessageOpts(options),
        ...DEFAULT_MESSAGE_OPTS_DJS
      }),
    'rethrow'
  )
}

export const publicLog = {
  info: (
    options: LogOptions<
    BaseMessageOptions,
    PendingSubmission | ValidatedSubmission
    >
  ) => genericLog({ ...options, level: 'info' }),
  warning: (
    options: LogOptions<
    BaseMessageOptions,
    PendingSubmission | ValidatedSubmission
    >
  ) => genericLog({ ...options, level: 'warning' }),
  error: (
    options: LogOptions<
    BaseMessageOptions,
    PendingSubmission | ValidatedSubmission
    >
  ) => genericLog({ ...options, level: 'error' })
}
