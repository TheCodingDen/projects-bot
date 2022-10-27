export function getAssignedGuilds (opts?: { includeMain?: boolean }): string[] {
  const guilds = []

  if (process.env.NODE_ENV === 'production') {
    guilds.push(process.env.STAFF_GUILD_ID as string)

    if (opts?.includeMain) {
      guilds.push(process.env.MAIN_GUILD_ID as string)
    }
  }

  guilds.push(process.env.DEVELOPMENT_GUILD_ID as string)

  return guilds
}
