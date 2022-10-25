import { VoteRole } from '@prisma/client'
import { GuildMember } from 'discord.js'
import config from '../config'

export function canVote (voter: GuildMember): boolean {
  const roles = voter.roles.cache
  const { veterans, staff } = config.roles()

  return roles.has(staff.id) || roles.has(veterans.id)
}

export function toVoteRole (voter: GuildMember): VoteRole {
  const roles = voter.roles.cache
  const { veterans, staff } = config.roles()

  // Staff takes priority as many staff also have the vet role
  if (roles.has(staff.id)) {
    return 'STAFF'
  } else if (roles.has(veterans.id)) {
    return 'VETERANS'
  } else {
    throw new Error(`voter ${voter.displayName} is not veterans or staff`)
  }
}
