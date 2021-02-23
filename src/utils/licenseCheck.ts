import { ProjectSubmission } from '../typings/interfaces'
import { GraphQLClient, gql } from 'graphql-request'

const ghClient = new GraphQLClient('https://api.github.com/graphql')

export function isEligibleForLicenseCheck (submission: ProjectSubmission): boolean {
  return submission.links.source.includes('github.com')
}

export async function hasSPDXLicense (submission: ProjectSubmission): Promise<boolean> {
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

  const licenseData = await ghClient.request(
    ghQuery,
    { url: submission.links.source },
    { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  )

  return !!(licenseData)?.resource?.licenseInfo
}
