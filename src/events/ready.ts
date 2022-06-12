import Discord from 'discord.js'

export default (client: Discord.Client): void => {
  log.info(`Logged in as ${client.user?.tag ?? ''}`)

  try {
    void client.user?.setPresence({
      status: 'online',
      activities: [
        {
          name: process.env.DISCORD_CLIENT_PRESENCE_MESSAGE,
          // Because DJS only accepts a subset of strings (that we cant know)
          // .. and this type is hard to access .. we will just cast to any.
          // This is very bad but its the only non trivial way to solve this problem.
          // Casting to the "correct" type has the same implications as any
          type: process.env.DISCORD_CLIENT_PRESENCE_TYPE as any
        }

      ]
    })
  } catch (err) {
    log.error(`Could not set startup presence: ${err}`)
  }
}
