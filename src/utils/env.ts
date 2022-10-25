import { ChannelType, Guild, Role, TextChannel } from 'discord.js'
import { client } from '..'

function reportInvalidConfig (key: string, value: unknown, expected: string): never {
  logger.error(`Config value ${key} was invalid, got ${value} expected ${expected}`)
  process.exit(1)
}

export function string (key: string): string {
  const value = process.env[key]

  if (!value) {
    reportInvalidConfig(key, value, 'a non empty string')
  }

  return value
}

export function number (key: string): number {
  const value = Number(string(key))

  if (isNaN(value)) {
    reportInvalidConfig(key, value, 'a number')
  }

  return value
}

export function boolean (key: string): boolean {
  const value = string(key)

  if (value !== 'true' && value !== 'false') {
    reportInvalidConfig(key, value, 'a boolean')
  }

  // Return true if the string is true, if not then it must be false
  return value === 'true'
}

export function textChannel (key: string): TextChannel {
  const id = string(key)
  const channel = client.channels.cache.get(id)

  if (!channel || channel.type !== ChannelType.GuildText) {
    reportInvalidConfig(key, `channel:${channel} id:${id}`, 'a text channel')
  }

  return channel
}

export function guild (key: string): Guild {
  const id = string(key)
  const guild = client.guilds.cache.get(id)

  if (!guild) {
    reportInvalidConfig(key, `guild:${guild} id:${id}`, 'a guild')
  }

  return guild
}

export function role (key: string, guild: Guild): Role {
  const id = string(key)
  const role = guild.roles.cache.get(id)

  if (!role) {
    reportInvalidConfig(key, `role:${guild} id:${id}`, 'a role')
  }

  return role
}
