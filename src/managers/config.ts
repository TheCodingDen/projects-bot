import { Guild, Snowflake, TextChannel } from 'discord.js'
import { Manager } from '.'
import config from '../config'

interface Emojis {
  upvote: string
  downvote: string
  pause: string
}

interface Roles {
  veterans: Snowflake
  staff: Snowflake
}

interface VotingThresholds {
  veterans: number
  staff: number
}

interface APISettings {
  port: number
  authToken: string
}

interface PresenceSettings {
  message: string
  type: string
}

interface GitHubSettings {
  token: string
}

interface BotSettings {
  token: string
  threadPrivacy: 'GUILD_PUBLIC_THREAD' | 'GUILD_PRIVATE_THREAD'
  shouldRegisterSlashCommands: boolean
}

interface Channels {
  publicShowcase: TextChannel
  publicFeedback: TextChannel

  privateSubmission: TextChannel
  privateLog: TextChannel
}

interface Guilds {
  testing: Guild
}

type NodeEnv = 'development' | 'production'

const requireNotNaN = (number: number, label: string): number => {
  if (isNaN(number)) {
    throw new Error(`Value '${label}' was NaN, expected valid number`)
  }

  return number
}

export class ConfigManager extends Manager {
  private getEnv (key: string, name: string): string {
    const envValue = process.env[key]

    if (!envValue) {
      throw new Error(`Missing env var ${name} (${key}), was not set or was set to an empty string.`)
    }

    return envValue
  }

  private getChannel (id: Snowflake, name: string): TextChannel {
    const ch = this.client.channels.cache.get(id)

    if (!ch || !(ch instanceof TextChannel)) {
      throw new Error(`Could not get channel '${name}', ID=${id}`)
    }

    return ch
  }

  private getGuild (id: Snowflake, name: string): Guild {
    const ch = this.client.guilds.cache.get(id)

    if (!ch) {
      throw new Error(`Could not get guild '${name}', ID=${id}`)
    }

    return ch
  }

  nodeEnv = (): NodeEnv => this.getEnv('NODE_ENV', 'node env') as NodeEnv

  apiSettings = (): APISettings => ({
    port: requireNotNaN(Number(this.getEnv('PORT', 'api port')), 'api port'),
    authToken: this.getEnv('API_AUTH_KEY', 'api auth key')
  })

  githubSettings = (): GitHubSettings => ({
    token: this.getEnv('GITHUB_TOKEN', 'github token')
  })

  presenceSettings = (): PresenceSettings => ({
    message: this.getEnv('DISCORD_CLIENT_PRESENCE_MESSAGE', 'presence message'),
    type: this.getEnv('DISCORD_CLIENT_PRESENCE_TYPE', 'presence type')
  })

  channels = (): Channels => ({
    publicShowcase: this.getChannel(this.getEnv('PUBLIC_SHOWCASE_CHANNEL', 'public showcase'), 'public showcase'),
    publicFeedback: this.getChannel(this.getEnv('PUBLIC_FEEDBACK_CHANNEL', 'public feedback'), 'public feedback'),

    privateSubmission: this.getChannel(this.getEnv('PRIVATE_SUBMISSION_CHANNEL', 'private submission'), 'private submission'),
    privateLog: this.getChannel(this.getEnv('PRIVATE_LOG_CHANNEL', 'private logs'), 'private logs')
  })

  guilds = (): Guilds => ({
    testing: this.getGuild(this.getEnv('TEST_GUILD_ID', 'testing guild id'), 'testing guild id')
  })

  emojis = (): Emojis => ({
    upvote: this.getEnv('UPVOTE_REACTION', 'upvote reaction'),
    downvote: this.getEnv('DOWNVOTE_REACTION', 'downvote reaction'),
    pause: this.getEnv('PAUSE_REACTION', 'paused reaction')
  })

  botSettings = (): BotSettings => ({
    token: this.getEnv('DISCORD_CLIENT_TOKEN', 'bot token'),
    // Public threads in dev because testing servers probably wont have nitro to support private threads
    threadPrivacy: this.nodeEnv() === 'development' ? 'GUILD_PUBLIC_THREAD' : 'GUILD_PRIVATE_THREAD',
    shouldRegisterSlashCommands: Boolean(this.getEnv('SHOULD_REGISTER_SLASH_COMMANDS', 'should register slash commands'))
  })

  roles = (): Roles => ({
    staff: this.getEnv('STAFF_ROLE_ID', 'staff role'),
    veterans: this.getEnv('VETERANS_ROLE_ID', 'veterans role')
  })

  voteThresholds = (): VotingThresholds => {
    const staff = Number(this.getEnv('STAFF_VOTING_THRESHOLD', 'staff voting threshold'))
    const veterans = Number(this.getEnv('VETERANS_VOTING_THRESHOLD', 'veterans voting threshold'))

    return {
      staff: requireNotNaN(staff, 'staff voting threshold'),
      veterans: requireNotNaN(veterans, 'veterans voting threshold')
    }
  }

  // Using typeof here because we just need static analysis on this data
  // The actual shape isnt too important, this just prevents typos on key names
  rejectionTemplates = (): typeof config.rejection.templates => config.rejection.templates
  rejectionDescriptions = (): typeof config.rejection.descriptions => config.rejection.descriptions

  rejectionWhitelist = (): readonly string[] => config.rejection.reviewWhitelist
}
