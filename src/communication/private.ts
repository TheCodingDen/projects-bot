import { BaseMessageOptions } from 'discord.js'
import config from '../config'
import { CompletedSubmission, PendingSubmission, ValidatedSubmission } from '../types/submission'
import { DEFAULT_MESSAGE_OPTS_DJS } from '../utils/communication'
import { runCatching } from '../utils/request'
import { InternalLogOptions, LogOptions, makeDjsMessageOpts } from './opts'

function genericLog (
  options: InternalLogOptions<
  BaseMessageOptions,
  PendingSubmission | ValidatedSubmission | CompletedSubmission
  >
): void {
  if (options.type === 'text') {
    options.content += `(Submission: ${options.ctx.name})`
  }

  void runCatching(
    async () =>
      await config.channels().privateLogs.send({
        ...DEFAULT_MESSAGE_OPTS_DJS,
        ...makeDjsMessageOpts(options)
      }),
    'rethrow'
  )
}

export const privateLog = {
  info: (
    options: LogOptions<
    BaseMessageOptions,
    PendingSubmission | ValidatedSubmission | CompletedSubmission
    >
  ) => genericLog({ ...options, level: 'info' }),
  warning: (
    options: LogOptions<
    BaseMessageOptions,
    PendingSubmission | ValidatedSubmission | CompletedSubmission
    >
  ) => genericLog({ ...options, level: 'warning' }),
  error: (
    options: LogOptions<
    BaseMessageOptions,
    PendingSubmission | ValidatedSubmission | CompletedSubmission
    >
  ) => genericLog({ ...options, level: 'error' })
}
