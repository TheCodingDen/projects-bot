import { ValidatedSubmission } from '../types/submission'
import { Vote } from '../types/vote'
import { stringify } from '../utils/stringify'
import { toVoteRole } from '../utils/vote'
import { query } from './client'

export async function addVote (vote: Vote, submission: ValidatedSubmission): Promise<void> {
  logger.debug(`Adding vote ${stringify.vote(vote)} to submission ${stringify.submission(submission)}`)
  return void query((db) =>
    db.vote.create({
      data: {
        voterId: vote.voter.id,
        role: toVoteRole(vote.voter),
        type: vote.type,
        submissionId: submission.id
      }
    })
  )
}

export async function removeVote (vote: Vote, submission: ValidatedSubmission): Promise<void> {
  logger.debug(`Removing vote ${stringify.vote(vote)} from submission ${stringify.submission(submission)}`)
  return void query((db) =>
    db.vote.delete({
      where: {
        voterId_submissionId_type: {
          voterId: vote.voter.id,
          submissionId: submission.id,
          type: vote.type
        }
      }
    })
  )
}
