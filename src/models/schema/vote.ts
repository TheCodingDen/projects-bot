import { Vote } from '@prisma/client'
import json from 'joi'
import { SNOWFLAKE_VALIDATOR } from '.'

export type VoteType = 'up' | 'down' | 'pause'

export const storedVoteDataValidator = json.object({
  type: json.string().valid('up', 'down', 'pause'),
  voter: SNOWFLAKE_VALIDATOR
})

export type ResolvedVote = Vote
