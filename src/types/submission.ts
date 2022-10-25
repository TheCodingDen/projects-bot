import { GuildMember, Message, Snowflake, ThreadChannel } from 'discord.js'
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
export type Submission = ApiSubmission | PendingSubmission | ValidatedSubmission | CompletedSubmission

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
