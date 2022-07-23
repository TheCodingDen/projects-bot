import { GuildMember } from 'discord.js'
import { ProjectsClient } from '../client'

export function isStaff (member: GuildMember, client: ProjectsClient): boolean {
  return member.roles.cache.has(client.config.roles().staff)
}

export function isVeteran (member: GuildMember, client: ProjectsClient): boolean {
  return member.roles.cache.has(client.config.roles().veterans)
}
