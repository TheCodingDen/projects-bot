import config from '../config'
import {
  PendingSubmission,
  Submission,
  ValidatedSubmission
} from '../types/submission'
import { DEFAULT_MESSAGE_OPTS_DJS } from '../utils/communication'
import { runCatching } from '../utils/request'

// Accept any submission type here, or none at all, as we may encounter internal errors before reaching a defined state
// or be unable to determine which submission we are working with at the time.
function genericLog (message: string, submission: Submission | undefined): void {
  void runCatching(async () =>
    await config.channels().internalLogs.send({
      content: `${message} (Submission: ${submission?.name ?? '???'})`,
      ...DEFAULT_MESSAGE_OPTS_DJS
    }), 'rethrow'
  )
}

const emojis = config.emojis().log
export const internalLog = {
  info: (
    message: string,
    submission: PendingSubmission | ValidatedSubmission
  ) => genericLog(`${emojis.info} ${message}`, submission),
  warning: (
    message: string,
    submission: PendingSubmission | ValidatedSubmission
  ) => genericLog(`${emojis.warning} ${message}`, submission),
  error: (message: string, submission: Submission | undefined) =>
    genericLog(`${emojis.error} ${message}`, submission)
}
