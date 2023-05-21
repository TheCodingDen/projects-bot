import { BaseMessageOptions } from 'discord.js'
import config from '../config'
import {
  PendingSubmission,
  AnySubmission,
  ValidatedSubmission
} from '../types/submission'
import { DEFAULT_MESSAGE_OPTS_DJS } from '../utils/communication'
import { runCatching } from '../utils/request'
import { InternalLogOptions, LogOptions, makeDjsMessageOpts } from './opts'

// Accept any submission type here, or none at all, as we may encounter internal errors before reaching a defined state
// or be unable to determine which submission we are working with at the time.
function genericLog (options: InternalLogOptions<BaseMessageOptions, AnySubmission | undefined>): void {
  if (options.type === 'text') {
    options.content += `(Submission: ${options.ctx?.name ?? '???'})`
  }

  void runCatching(async () =>

    await config.channels().internalLogs.send({
      ...DEFAULT_MESSAGE_OPTS_DJS,
      ...makeDjsMessageOpts(options)
    }), 'rethrow'
  )
}

export const internalLog = {
  info: (
    options: LogOptions<BaseMessageOptions, PendingSubmission | ValidatedSubmission>
  ) => genericLog({ ...options, level: 'info' }),
  warning: (
    options: LogOptions<BaseMessageOptions, PendingSubmission | ValidatedSubmission>
  ) => genericLog({ ...options, level: 'warning' }),
  error: (
    options: LogOptions<BaseMessageOptions, AnySubmission | undefined>
  ) => genericLog({ ...options, level: 'error' })
}
