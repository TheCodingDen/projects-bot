import { GuildMember } from 'discord.js'

export type VoteType = 'UPVOTE' | 'DOWNVOTE' | 'PAUSE' | 'UNPAUSE'
export type VoteRole = 'VETERANS' | 'STAFF'

export interface Vote {
  type: VoteType
  voter: GuildMember
  role: VoteRole
}
