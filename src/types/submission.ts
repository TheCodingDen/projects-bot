import { GuildMember, Message, Snowflake, ThreadChannel } from 'discord.js'
import { Draft } from './draft'
import { SubmissionId } from './misc'
import { Vote } from './vote'

/**
 * Represents the state of the submission. Callers are advised to use the other types exported
 * by this module instead of conditionally checking the state of the submission.
 */
export type SubmissionState = 'RAW' | 'WARNING' | 'PROCESSING' | 'PAUSED' | 'ERROR' | 'ACCEPTED' | 'DENIED'

/**
 * Represents a general submission which could be in any state.
 */
export type AnySubmission = ApiSubmission | PendingSubmission | ValidatedSubmission | CompletedSubmission

/**
 * The base submission type, has no additional data.
 */
export interface BaseSubmission {
  state: SubmissionState

  name: string
  authorId: Snowflake
  description: string
  tech: string
  links: {
    source: string
    other: string
  }
}

/**
 * Represents a submission as it comes from the API, with no validation or modification to it.
 */
export interface ApiSubmission extends BaseSubmission {
  state: 'RAW'
}

/**
 * Represents a submission that is in an unfinished state, this could be from validation issues or from failed external checks.
 * This state may be simple warnings or prohibitive errors.
 * If validation fails, the submission cannot be voted on and must be manually fixed.
 * If any other error occurs (API errors, Database errors), the user will have to retry the setup process.
 */
export interface PendingSubmission extends BaseSubmission {
  state: 'WARNING' | 'ERROR'
  id: SubmissionId
  submittedAt: Date
}

/**
 * Represents a fully validated submission ready for voting.
 * This state asserts all core data is ready and available.
 */
export interface ValidatedSubmission extends BaseSubmission {
  state: 'PROCESSING' | 'PAUSED'
  id: SubmissionId
  submittedAt: Date

  reviewThread: ThreadChannel
  feedbackThread: ThreadChannel | undefined
  submissionMessage: Message
  author: GuildMember

  votes: Vote[]
  drafts: Draft[]
}

/**
 * Represents a completed submission. We do not clear data from the database, but rather set the state to "deleted", "accepted", or "denied".
 * This type exists to fill out the state enum and represents a "never" state for the submission.
 */
export interface CompletedSubmission extends BaseSubmission {
  state: 'ACCEPTED' | 'DENIED'
  id: SubmissionId
  submittedAt: Date

  // Author may no longer exist when we fetch in this state
  author?: GuildMember
}

// These type guards exist for more readable code, and better TS behavior
// TS struggles to infer the types in some cases, and this should help with that.

/**
 * Returns whether a submission is in the raw / API state.
 */
export function isRaw (submission: AnySubmission): submission is ApiSubmission {
  return submission.state === 'RAW'
}

/**
 * Returns whether a submission is in the pending state.
 */
export function isPending (submission: AnySubmission): submission is PendingSubmission {
  return submission.state === 'WARNING' || submission.state === 'ERROR'
}

/**
 * Returns whether a submission is in the valided state.
 */
export function isValidated (submission: AnySubmission): submission is ValidatedSubmission {
  return submission.state === 'PROCESSING' || submission.state === 'PAUSED'
}

/**
 * Returns whether a submission is in the completed state.
 */
export function isCompleted (submission: AnySubmission): submission is CompletedSubmission {
  return submission.state === 'ACCEPTED' || submission.state === 'DENIED'
}
