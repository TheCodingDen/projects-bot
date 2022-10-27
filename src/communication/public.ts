import config from '../config'
import { PendingSubmission, ValidatedSubmission } from '../types/submission'
import { DEFAULT_MESSAGE_OPTS_DJS } from '../utils/communication'
import { runCatching } from '../utils/request'

function genericLog (message: string, submission: PendingSubmission | ValidatedSubmission): void {
  void runCatching(async () =>
    await config.channels().publicLogs.send({
      content: `${message} (Submission: ${submission.name})`,
      ...DEFAULT_MESSAGE_OPTS_DJS
    }), 'rethrow'
  )
}

const emojis = config.emojis().log
export const publicLog = {
  info: (
    message: string,
    submission: PendingSubmission | ValidatedSubmission
  ) => genericLog(`${emojis.info} ${message}`, submission),
  warning: (
    message: string,
    submission: PendingSubmission | ValidatedSubmission
  ) => genericLog(`${emojis.warning} ${message}`, submission),
  error: (
    message: string,
    submission: PendingSubmission | ValidatedSubmission
  ) => genericLog(`${emojis.error} ${message}`, submission)
}
