import { Draft, RelatedMessage, Submission, SubmissionDetails, SubmissionLink, Vote } from '@prisma/client'
import { Snowflake } from 'discord.js'
import json from 'joi'
import { DESCRIPTION_MAX_LENGTH, EXTRA_INFO_MAX_LENGTH, NAME_MAX_LENGTH, SNOWFLAKE_VALIDATOR } from '.'
import { Vote as VoteModel } from '../vote'

export type SubmissionState = 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DELETED'

// Whilst this isn't used here, it makes sense to store all of the data stuff together
interface ResolvedVoteObject {
  staff: VoteModel[]
  veterans: VoteModel[]
}

// Whilst this isn't used here, it makes sense to store all of the data stuff together
export interface SubmissionVotes {
  upvotes: ResolvedVoteObject
  downvotes: ResolvedVoteObject
  pauses: VoteModel[]
}

// This is the data we get through the API, the "incoming" data
export interface IncomingSubmissionData {
  name: string
  author: Snowflake
  description: string
  tech: string
  links: {
    source: string
    other: string
  }
}

export const incomingSubmissionValidator = json.object({
  name: json.string().max(NAME_MAX_LENGTH),
  author: SNOWFLAKE_VALIDATOR,
  // Descriptions may contain formatting
  description: json.string().max(DESCRIPTION_MAX_LENGTH),
  tech: json.string().max(EXTRA_INFO_MAX_LENGTH),
  links: json.object({
    source: json.string().max(EXTRA_INFO_MAX_LENGTH),
    other: json.string().max(EXTRA_INFO_MAX_LENGTH)
  })
})

// Prisma util types
export type ResolvedSubmission = Submission & {
  details: SubmissionDetails
  links: SubmissionLink[]
  votes: Vote[]
  relatedMessages: RelatedMessage[]
  drafts: Draft[]
}
