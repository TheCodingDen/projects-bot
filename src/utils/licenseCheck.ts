import { ProjectSubmission } from '../typings/interfaces'
import { GraphQLClient, gql } from 'graphql-request'

const ghClient = new GraphQLClient('https://api.github.com/graphql')
ghClient.setHeader('Authorization', `Bearer ${process.env.GITHUB_TOKEN}`)

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

  const licenseData = await ghClient.request(ghQuery, { url: submission.links.source })

  return !!(licenseData)?.resource?.licenseInfo
}
