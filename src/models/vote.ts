import { VoteType, Vote as StoredVote } from '@prisma/client'
import { GuildMember, Snowflake } from 'discord.js'
import { Model } from '.'
import { ProjectsClient } from '../client'

import { Submission } from './submission'
import { isStaff } from '../utils/member'

export type VoteModificationOutcome = 'approved' | 'rejected' | 'paused' | 'unpaused' | 'error' | 'ok'
export interface VoteModificationResult {
  outcome: VoteModificationOutcome
  reason: string
}

export type VoteAction = 'add' | 'remove' | 'stored'

/**
 * Represents a vote on a Submission. Votes may be active (state 'add' or 'remove')
 * or they may be stored (state 'stored').
 *
 * Active votes need to be processed by the bot, to either add or remove votes
 * from a submission. Stored votes are votes that have already been processed and
 * are stored in the datastore.
 */
export class Vote extends Model<StoredVote> {
  constructor (
    client: ProjectsClient,
    public readonly type: VoteType,
    public readonly action: VoteAction,
    public readonly voter: GuildMember,
    public readonly submissionId: Snowflake
  ) {
    super(client)
  }

  isUp (): boolean {
    return this.type === 'UP'
  }

  isDown (): boolean {
    return this.type === 'DOWN'
  }

  isPause (): boolean {
    return this.type === 'PAUSE' && this.action === 'add'
  }

  isPauseRelated (): boolean {
    return this.isPause() || this.isUnpause()
  }

  isUnpause (): boolean {
    // Unpause is just removing of the pause reaction
    return this.type === 'PAUSE' && this.action === 'remove'
  }

  private hasEnoughVotes (mode: 'UP' | 'DOWN', project: Submission): boolean {
    // Reject impossible cases
    if (mode === 'UP' && !this.isUp()) {
      return false
    }

    if (mode === 'DOWN' && !this.isDown()) {
      return false
    }

    const { staff: staffRole, veterans: veteransRole } = this.client.config.roles()
    const roles = this.voter.roles.cache

    const isStaff = roles.has(staffRole)
    const isVeteran = roles.has(veteransRole)

    // Access the correct vote count based on mode and voter roles
    const currentVotes = (mode === 'UP' ? project.votes.upvotes : project.votes.downvotes)[isStaff ? 'staff' : 'veterans'].length

    let newVotes
    if (this.action === 'add') {
      newVotes = currentVotes + 1
    } else if (this.action === 'remove') {
      newVotes = currentVotes - 1
    } else {
      throw new Error(`Unknown action ${this.action}`)
    }

    let canApprove
    const { staff: staffThreshold, veterans: veteransThreshold } = this.client.config.voteThresholds()

    if (isStaff) {
      canApprove = newVotes >= staffThreshold
    } else if (isVeteran) {
      canApprove = newVotes >= veteransThreshold
    } else {
      // Callers should check this.
      throw new Error('Attempted to compute vote for member who is not staff or veteran?')
    }

    return canApprove
  }

  /**
   * Would casting this vote reject the supplied submission?
   */
  rejectsProject (project: Submission): boolean {
    return this.hasEnoughVotes('DOWN', project)
  }

  /**
   * Would casting this vote approve the supplied submission?
   */
  approvesProject (project: Submission): boolean {
    return this.hasEnoughVotes('UP', project)
  }

  /**
   * Would casting this vote pause the supplied submission?
   */
  pausesProject (submission: Submission): boolean {
    const isCurrentlyPaused = submission.state === 'PAUSED'
    const areWePausing = this.isPause()

    // Is the project paused, and are we going to pause it?
    return !isCurrentlyPaused && areWePausing
  }

  toSerialised (): StoredVote {
    return {
      type: this.type,
      voterId: this.voter.id,
      submissionId: this.submissionId,
      // This ID is just to satisfy constraints, and has the same value as the submission ID
      submissionDetailsId: this.submissionId,
      role: isStaff(this.voter, this.client) ? 'STAFF' : 'VETERANS'
    }
  }

  toString (): string {
    return `Vote { type: ${this.type}, action: ${this.action}, voter: ${this.voter.user.tag} (${this.voter.id}), submissionId: ${this.submissionId} }`
  }
}
