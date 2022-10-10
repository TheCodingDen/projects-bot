import { Err, Ok, Result } from 'ts-results'
import { ProjectsClient } from '../client'
import { Submission } from '../models/submission'

/**
 * Checks the database for duplicate submissions based on submission name and source links.
 */
export async function checkForDuplicates (submission: Submission, client: ProjectsClient): Promise<Result<boolean, Error>> {
  // Search for potential duplicates with same source and same name
  // findFirst rather than findUnique because names aren't unique
  const haveSameName = await client.db.exec(db => db.submissionDetails.findFirst({
    where: {
      name: submission.name
    }
  }))

  const haveSameSource = await client.db.exec(db => db.submissionLink.findFirst({
    where: {
      type: 'SOURCE',
      url: submission.links.source
    }
  }))

  if (haveSameName.err) {
    return Err(haveSameName.val)
  }

  if (haveSameSource.err) {
    return Err(haveSameSource.val)
  }

  return Ok(haveSameName.val !== null || haveSameSource.val !== null)
}
