import { Guild, GuildMember } from 'discord.js'
import { Manager } from '.'
import { SubmissionState } from '../models/schema/submission'
import { Vote as StoredVote } from '@prisma/client'
import { Submission } from '../models/submission'
import { Vote, VoteModificationOutcome, VoteModificationResult } from '../models/vote'
import { log } from '../utils/logger'
import { Err, Ok, Result } from 'ts-results'

export class VoteManager extends Manager {
  async resolve (raw: StoredVote, guild: Guild): Promise<Result<Vote, Error>> {
    const voterRes = await Result.wrapAsync(async () => await guild.members.fetch(raw.voterId))

    if (voterRes.err) {
      const err = voterRes.val

      log.error(`Failed to fetch voter ${raw.voterId}`)
      log.error(err)

      return Err(err as Error)
    }

    return Ok(new Vote(this.client, raw.type, 'stored', voterRes.val, raw.submissionId))
  }

  private async actionVote (mode: 'UP' | 'DOWN', action: 'add' | 'remove', project: Submission, voter: GuildMember): Promise<VoteModificationResult> {
    const { staff: staffRole, veterans: veteransRole } = this.client.config.roles()
    const vote = new Vote(this.client, mode, action, voter, project.id)
    const isStaff = voter.roles.cache.has(staffRole)
    const isVeteran = voter.roles.cache.has(veteransRole)

    if (!isStaff && !isVeteran) {
      log.warn(`User ${voter} attempted to ${action === 'add' ? `${mode}vote` : `remove ${mode}vote for`} project ${project.name} (${project.id}), but member is neither staff nor veteran`)
      return { outcome: 'error', reason: 'Member does not have voting privileges' }
    } else {
      const hasEnoughDownvotes = vote.rejectsProject(project)
      const hasEnoughUpvotes = vote.approvesProject(project)

      let newState: SubmissionState
      let newOutcome: VoteModificationOutcome

      if (hasEnoughUpvotes) {
        newState = 'APPROVED'
        newOutcome = 'approved'
      } else if (hasEnoughDownvotes) {
        newState = 'REJECTED'
        newOutcome = 'rejected'
      } else {
        newState = 'PROCESSING'
        newOutcome = 'ok'
      }

      log.debug(`Entering vote ${vote.action} ${JSON.stringify(vote.toSerialised())}`)
      log.debug(`Project state before vote: ${JSON.stringify(project.toSerialised())}`)

      if (action === 'add') {
        project.pushVote(vote)
      } else if (action === 'remove') {
        project.removeVote(vote)
      } else {
        throw new Error(`Unknown action ${action}`)
      }

      log.debug(`Project state after vote: ${JSON.stringify(project.toSerialised())}.. persisted in the DB`)

      const dbRes = await this.client.db.exec(db => db.submissionDetails.update({
        where: { submissionId: project.id },
        data: {
          state: newState
        }
      }))

      if (dbRes.err) {
        return { outcome: 'error', reason: `DB error: ${JSON.stringify(dbRes.val)}` }
      }

      return { outcome: newOutcome, reason: '' }
    }
  }

  /**
   * Add or remove a downvote from a submission.
   */
  async downvote (project: Submission, voter: GuildMember, action: 'add' | 'remove'): Promise<VoteModificationResult> {
    return await this.actionVote('DOWN', action, project, voter)
  }

  /**
   * Add or remove an upvote from a submission.
   */
  async upvote (project: Submission, voter: GuildMember, action: 'add' | 'remove'): Promise<VoteModificationResult> {
    return await this.actionVote('UP', action, project, voter)
  }

  /**
   * Change the suspension state of a submission.
   */
  async changeSuspensionState (project: Submission, suspender: GuildMember, action: 'suspend' | 'unsuspend'): Promise<VoteModificationResult> {
    const { staff } = this.client.config.roles()

    const isStaff = suspender.roles.cache.has(staff)

    if (!isStaff) {
      log.warn(`User ${suspender} attempted to ${action} voting on project ${project} (${project.id}), but user is not staff`)
      return { outcome: 'error', reason: 'Member does not have pausing privileges' }
    }

    const vote = new Vote(this.client, 'PAUSE', action === 'suspend' ? 'add' : 'remove', suspender, project.id)

    if (action === 'suspend') {
      project.pushVote(vote)
      project.setPaused()
    } else {
      project.removeVote(vote)
      project.setUnpaused()
    }

    const dbRes = await this.client.submissions.update(project)

    if (dbRes.err) {
      return { outcome: 'error', reason: `DB error: ${JSON.stringify(dbRes.val)}` }
    }

    return { outcome: action === 'suspend' ? 'paused' : 'ok', reason: '' }
  }
}
