import Discord, { Snowflake } from 'discord.js'
import { Model } from '.'
import { ProjectsClient } from '../client'
import { crossProduct, remove } from '../utils/arrays'
import { IncomingSubmissionData, ResolvedSubmission, SubmissionState, SubmissionVotes } from './schema/submission'
import { SubmissionLinkType, SubmissionLink, RelatedMessage, Vote as PrismaVote, Draft } from '@prisma/client'

import { log } from '../utils/logger'
import { Vote } from './vote'
import { Err, Ok, Result } from 'ts-results'

const VOTE_TYPE = {
  UP: 'upvotes',
  DOWN: 'downvotes',
  PAUSE: 'pauses'
} as const

export class Submission extends Model<ResolvedSubmission> {
  private readonly _data: ResolvedSubmission

  get state (): SubmissionState {
    return this._data.details.state
  }

  get data (): Readonly<ResolvedSubmission> {
    return {
      ...this._data
    }
  }

  get name (): string {
    return this._data.details.name
  }

  get id (): Snowflake {
    return this._data.id
  }

  get description (): string {
    return this._data.details.description
  }

  get links (): Readonly<{ source: string, other: string }> {
    const links = this._data.links
    let source = links.find(l => l.type === 'SOURCE')?.url
    let other = links.find(l => l.type === 'OTHER')?.url

    if (!source) {
      log.warn(`Could not resolve source link for submission ${this.id}.`)
      source = 'Not found'
    }

    if (!other) {
      log.warn(`Could not resolve other link for submission ${this.id}.`)
      other = 'Not found'
    }

    return { source, other }
  }

  get techUsed (): string {
    return this._data.details.techUsed
  }

  get relatedMessages (): RelatedMessage[] {
    return this._data.relatedMessages
  }

  public readonly drafts: SubmissionDrafts

  constructor (
    client: ProjectsClient,
    data: ResolvedSubmission,

    public readonly author: Discord.User,
    public readonly message: Discord.Message,
    // Votes are passed as models here but are stored as their serialised type in `data`
    public readonly votes: SubmissionVotes
  ) {
    super(client)
    this._data = data
    this.drafts = new SubmissionDrafts(this, client)
  }

  isPaused (): boolean {
    return this.state === 'PAUSED'
  }

  isApproved (): boolean {
    return this.state === 'APPROVED'
  }

  isRejected (): boolean {
    return this.state === 'REJECTED'
  }

  isDeleted (): boolean {
    return this.state === 'DELETED'
  }

  isProcessing (): boolean {
    return this.state === 'PROCESSING'
  }

  setRejected (/* TODO: reasons */): void { this._data.details.state = 'REJECTED' }
  setApproved (): void { this._data.details.state = 'APPROVED' }

  setPaused (): void { this._data.details.state = 'PAUSED' }
  setUnpaused (): void { this._data.details.state = 'PROCESSING' }

  pushVote (vote: Vote): void {
    const { staff } = this.client.config.roles()
    const roles = vote.voter.roles.cache

    const isStaff = roles.has(staff)

    const votes = this.votes[VOTE_TYPE[vote.type]]

    if (Array.isArray(votes)) {
      // Pause case
      votes.push(vote)
      return
    }

    votes[isStaff ? 'staff' : 'veterans'].push(vote)
  }

  removeVote (vote: Vote): void {
    const { staff } = this.client.config.roles()
    const roles = vote.voter.roles.cache

    const isStaff = roles.has(staff)

    const votes = this.votes[VOTE_TYPE[vote.type]]

    if (Array.isArray(votes)) {
      // Pause case
      remove(votes, v => v.voter.id === vote.voter.id && v.type === vote.type)
      return
    }

    remove(votes[isStaff ? 'staff' : 'veterans'], v => v.voter.id === vote.voter.id && v.type === vote.type)
  }

  private getLink (key: SubmissionLinkType): SubmissionLink | undefined {
    return this._data.links.find(s => s.type === key)
  }

  private setLink<T extends keyof SubmissionLink>(type: SubmissionLinkType, key: T, value: SubmissionLink[T]): void {
    const link = this.getLink(type)

    if (!link) {
      log.warn(`Could not resolve ${key.toLowerCase()} link for submission ${this.id}.`)
      return
    }

    link[key] = value
  }

  // Only allow specific things to be changed
  updateValue (field: 'name' | 'description' | 'source' | 'other' | 'technologies', value: string): void {
    ({
      name: () => (this._data.details.name = value),
      description: () => (this._data.details.description = value),
      technologies: () => (this._data.details.techUsed = value),
      source: () => (this.setLink('SOURCE', 'url', value)),
      other: () => (this.setLink('OTHER', 'url', value))
    }[field]())
  }

  private flattenVotes (): PrismaVote[] {
    const votes = crossProduct(
      ['upvotes', 'downvotes'] as const,
      ['staff', 'veterans'] as const
    )
      .flatMap(([a, b]) =>
        this.votes[a][b].map(v => v.toSerialised())
      )

    // Push pauses
    for (const v of this.votes.pauses) {
      votes.push(v.toSerialised())
    }

    return votes
  }

  toSerialised (): ResolvedSubmission {
    const data = this._data

    return {
      id: data.id,
      details: {
        submissionId: data.id,
        messageId: data.details.messageId,
        reviewThreadId: data.details.reviewThreadId,
        name: data.details.name,
        description: data.details.description,
        techUsed: data.details.techUsed,
        state: data.details.state,
        authorId: data.details.authorId
      },
      links: data.links,
      drafts: data.drafts,
      relatedMessages: data.relatedMessages,
      votes: this.flattenVotes()
    }
  }

  toIncoming (): IncomingSubmissionData {
    return {
      name: this.name,
      description: this.description,
      author: this.author.id,
      tech: this.techUsed,
      links: this.links
    }
  }

  toString (): string {
    return `Submission { name: ${this.name}, id: ${this.id}, author: ${this.author.tag} (${this.author.id})}`
  }
}

export class SubmissionDrafts {
  constructor (private readonly submission: Submission, private readonly client: ProjectsClient) { }

  async push (newDraft: string): Promise<Result<void, Error>> {
    const draft = await this.client.db.exec(db => db.draft.create({
      data: {
        content: newDraft,
        submissionId: this.submission.id
      }
    }))

    if (draft.err) {
      return Err(draft.val)
    }

    this.submission.data.drafts.push(draft.val)
    return Ok.EMPTY
  }

  all (): Draft[] {
    return this.submission.data.drafts
  }

  currentDraft (): Draft | undefined {
    return this.submission.data.drafts[0]
  }
}
