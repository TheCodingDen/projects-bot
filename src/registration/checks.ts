import { GuildMember, ThreadChannel } from 'discord.js'
import { gql, GraphQLClient } from 'graphql-request'
import { genericLog } from '../communication/thread'
import config from '../config'
import { query } from '../db/client'
import { ApiSubmission, ValidatedSubmission } from '../types/submission'
import { runCatching } from '../utils/request'

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
  submission: ValidatedSubmission
): Promise<boolean> {
  let result = true

  const isDuplicate = await checkForDuplicate(submission)

  if (isDuplicate) {
    genericLog.warning({
      type: 'text',
      content:
        'Possible duplicate submission detected, matched submission links.',
      ctx: submission.reviewThread
    })

    result = false
  }

  if (isGitHubSource(submission)) {
    const licenseRes = await runGitHubChecks(submission)

    if (licenseRes.outcome !== 'success') {
      genericLog.warning({
        type: 'text',
        content: licenseRes.message,
        ctx: submission.reviewThread
      })

      result = false
    } else {
      genericLog.info({
        type: 'text',
        content: licenseRes.message,
        ctx: submission.reviewThread
      })
    }
  }

  return result
}

async function checkForDuplicate (
  submission: ValidatedSubmission
): Promise<boolean> {
  const count = await query((db) =>
    db.submission.count({
      where: {
        AND: [
          {
            sourceLinks: {
              contains: submission.links.source
            }
          },
          {
            otherLinks: {
              contains: submission.links.other
            }
          }
        ]
      }
    })
  )

  // We insert the submission before this code runs, so we count how many match
  // and if it is > 1, that means there's a duplicate somewhere
  return count > 1
}

const ghClient = new GraphQLClient('https://api.github.com/graphql')

interface GitHubResult {
  outcome:
  | 'error'
  | 'success'
  | 'invalid-license'
  | 'empty-repository'
  | 'archived-repository'
  | 'locked-repository'
  message: string
}

function isGitHubSource (submission: ValidatedSubmission): boolean {
  return submission.links.source.includes('github.com')
}

async function runGitHubChecks (
  submission: ValidatedSubmission
): Promise<GitHubResult> {
  const ghQuery = gql`
    query ($url: URI!) {
      resource(url: $url) {
        ... on Repository {
          licenseInfo {
            spdxId
          }
          isEmpty
          isArchived
          isDisabled

          isLocked
          lockReason
        }
      }
    }
  `

  const res: undefined | any = await runCatching(
    async () =>
      await ghClient.request(
        ghQuery,
        { url: submission.links.source },
        { authorization: `Bearer ${config.github().token}` }
      ),
    'supress'
  )

  if (!res) {
    return {
      outcome: 'error',
      message: 'Failed to run GitHub checks, API returned an error.'
    }
  }

  const data = res.resource

  if (!data) {
    return {
      outcome: 'error',
      message:
        'GitHub reported no data on this submission, repository likely doesnt exist or is private.'
    }
  }

  if (data.isEmpty) {
    return {
      outcome: 'empty-repository',
      message: 'GitHub reports this repository as being empty.'
    }
  }

  if (data.isArchived) {
    return {
      outcome: 'archived-repository',
      message: 'GitHub reports this repository as being archived.'
    }
  }

  if (data.isLocked) {
    return {
      outcome: 'locked-repository',
      message: `GitHub reports this repository as being locked (${data.lockReason}).`
    }
  }
  const hasValidLicense = data?.licenseInfo

  if (!hasValidLicense) {
    return {
      outcome: 'invalid-license',
      message: 'GitHub reports no valid SPDX license for the project.'
    }
  }

  return {
    outcome: 'success',
    message: 'GitHub checks passed.'
  }
}
