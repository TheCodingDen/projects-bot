import { GuildMember, ThreadChannel } from 'discord.js'
import { gql, GraphQLClient } from 'graphql-request'
import { genericLog } from '../communication/thread'
import config from '../config'
import { query } from '../db/client'
import { ApiSubmission, ValidatedSubmission } from '../types/submission'
import { runCatching } from '../utils/request'
import { Submission } from '@prisma/client'

interface RequiredValuesOk {
  author: GuildMember
  error: false
}

interface RequiredValuesErr {
  message: string
  error: true
}

export type RequiredValuesResult = RequiredValuesOk | RequiredValuesErr

// The check functions here will handle the reporting of errors to the user
// but will not handle the cleanup / any further operations after that.
// Those should be handled by the caller.

export async function resolveRequiredValues (
  submission: ApiSubmission,
  reviewThread: ThreadChannel
): Promise<RequiredValuesResult> {
  const guild = config.guilds().current

  try {
    const member = await guild.members.fetch(submission.authorId)

    // d.js has been observed to return undefined in some cases here, for unknown reasons.
    // the types do not specify this, so it's not known why this happens.
    // check it for sanity.
    if (!member?.user) {
      genericLog.error({
        type: 'text',
        content: `Could not locate author for this submission (${submission.authorId})`,
        ctx: reviewThread
      })

      return {
        error: true,
        message: `Unknown user ${submission.authorId}`
      }
    }

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

  const duplicateSubmissions = await listDuplicates(submission)
  const isDuplicate = duplicateSubmissions.length > 0

  if (isDuplicate) {
    let duplicateContent = 'Possible duplicate submission detected, matched submission links. Matches:\n'
    for (const duplicate of duplicateSubmissions) {
      duplicateContent += `  ${duplicate.name} [${duplicate.sourceLinks}] (<#${duplicate.reviewThreadId}>)\n`
    }

    genericLog.warning({
      type: 'text',
      content: duplicateContent,
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

async function listDuplicates (
  submission: ValidatedSubmission
): Promise<Submission[]> {
  const duplicates = await query(async (db) =>
    await db.submission.findMany({
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
      },
      // Order by the submission date
      orderBy: {
        submittedAt: 'desc'
      }
    })
  )

  // We insert the submission before this code runs, so we slice the first element off.
  return duplicates.slice(1)
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
    'suppress'
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
        "GitHub reported no data on this submission, repository likely doesn't exist or is private."
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
