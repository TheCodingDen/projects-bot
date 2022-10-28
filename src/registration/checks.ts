import { GuildMember, ThreadChannel } from 'discord.js'
import { genericLog } from '../communication/thread'
import config from '../config'
import { ApiSubmission, ValidatedSubmission } from '../types/submission'

interface CriticalCheckOk {
  author: GuildMember
  error: false
}

interface CriticalCheckErr {
  message: string
  error: true
}

export type CriticalCheckResult = CriticalCheckOk | CriticalCheckErr

// The check functions here will handle the reporting of errors, but not the side effects of such.
// This should be handled by the caller.

export async function runCriticalChecks (
  submission: ApiSubmission,
  reviewThread: ThreadChannel
): Promise<CriticalCheckResult> {
  const guild = config.guilds().current

  try {
    const member = await guild.members.fetch(submission.authorId)

    return {
      error: false,
      author: member
    }
  } catch (err) {
    genericLog.error({
      type: 'text',
      content: `Could not locate author for this submission (${submission.authorId})`,
      ctx: reviewThread
    })

    return {
      error: true,
      message: (err as Error).message
    }
  }
}

/**
 * Runs the non critical checks.
 * The result of these checks is not critical for application function.
 * Returns `true` if the checks passed, `false` otherwise.
 */
export async function runNonCriticalChecks (
  _submission: ValidatedSubmission
): Promise<boolean> {
  return true
}
