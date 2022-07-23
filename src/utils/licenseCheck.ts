import { GraphQLClient, gql } from 'graphql-request'
import { Err, Ok, Result } from 'ts-results'
import { ProjectsClient } from '../client'
import { Submission } from '../models/submission'

export interface GitHubLicenseData {
  resource: { licenseInfo: { spdxId: string } | null }
}

const ghClient = new GraphQLClient('https://api.github.com/graphql')

/**
 * Checks if the incoming submission qualifies for license checking.
 * Currently, that is only supported on GitHub URLs.
 */
export function isEligibleForLicenseCheck (submission: Submission): boolean {
  return submission.links.source.includes('github.com')
}

/**
 * Checks if the incoming submission has a valid SPDX license attached to it.
 * NB: A negative result does not mean that it's an invalid licence, as GitHub does not always recognise the licences.
 */
export async function hasSPDXLicense (submission: Submission, client: ProjectsClient): Promise<Result<boolean, Error>> {
  const ghQuery = gql`
    query ($url: URI!) {
      resource(url: $url) {
        ... on Repository {
          licenseInfo {
            spdxId
          }
        }
      }
    }
    `

  const licenseRes = await Result.wrapAsync(async () =>
    await ghClient.request(
      ghQuery,
      { url: submission.links.source },
      { authorization: `Bearer ${client.config.githubSettings().token}` }
    )
  )

  if (licenseRes.err) {
    return Err(licenseRes.val as Error)
  }

  return Ok(!!licenseRes.val?.resource?.licenseInfo)
}
