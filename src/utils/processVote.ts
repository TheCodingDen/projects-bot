import { MessageReaction } from 'discord.js'
import { Err, Ok, Result } from 'ts-results'
import { ProjectsClient } from '../client'
import { botRemovedReactions } from '../events/messageReactionRemove'
import { Submission } from '../models/submission'
import { Vote, VoteModificationResult } from '../models/vote'
import { approve, reject, suspend, unsuspend } from './actionVotes'
import { assert } from './assert'
import { log } from './logger'

export async function processVote (submission: Submission, vote: Vote, reaction: MessageReaction, client: ProjectsClient): Promise<Result<void, Error>> {
  assert(vote.action !== 'stored', 'attempted to process a stored vote')

  // If the submission is paused, the only valid operation is to unpause; deny all other votes.
  assert(!submission.isPaused() || (vote.action === 'remove' && vote.type === 'PAUSE'), 'attempted to add a vote on a paused project')

  const shouldSuspend = vote.isPause()

  // Is the vote pause related?
  const isPauseRelated = vote.isPauseRelated()

  log.debug(`Processing vote ${vote} on submission ${submission}`)

  // We need this check so the inner if/else works, otherwise the else would trigger for non pause votes
  if (isPauseRelated) {
    if (shouldSuspend) {
      return await handleErrorResult(await suspend(submission, vote, client), reaction, vote, submission, client)
    } else {
      return await handleErrorResult(await unsuspend(submission, vote, client), reaction, vote, submission, client)
    }
  }

  if (vote.isUp()) {
    const res = await client.votes.upvote(submission, vote.voter, vote.action)

    if (res.outcome === 'error') {
      return await handleErrorResult(res, reaction, vote, submission, client)
    }

    if (res.outcome === 'approved') {
      return await handleErrorResult(await approve(submission, vote, client), reaction, vote, submission, client)
    }
  }

  if (vote.isDown()) {
    const res = await client.votes.downvote(submission, vote.voter, vote.action)

    if (res.outcome === 'error') {
      return await handleErrorResult(res, reaction, vote, submission, client)
    }

    if (res.outcome === 'rejected') {
      return await handleErrorResult(await reject(submission, vote, client), reaction, vote, submission, client)
    }
  }

  return Ok.EMPTY
}

async function handleErrorResult (result: VoteModificationResult, reaction: MessageReaction, vote: Vote, submission: Submission, client: ProjectsClient): Promise<Result<void, Error>> {
  if (result.outcome === 'error') {
    // Add the user id to the removed reactions set so we don't process this reaction remove event accidentally
    botRemovedReactions.add(vote.voter.id)

    const reactionRes = await Result.wrapAsync(async () => await reaction.users.remove(vote.voter.id))

    log.error(`Failed to cast vote ${vote} on submission ${submission}, reason: ${result.reason}`)
    await client.communication.reportWarning(`<@${vote.voter.id}>: Your vote could not be cast. Reason: ${result.reason}`, submission)

    if (reactionRes.err) {
      return Err(reactionRes.val as Error)
    }
  }

  return Ok.EMPTY
}
