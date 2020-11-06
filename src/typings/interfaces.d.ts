import Discord from 'discord.js'

export interface ProjectSubmission {
  id: Discord.Snowflake
  name: string
  author: Discord.Snowflake
  description: string
  tech: string
  links: {
    source: string
    other: string
  }
}

export interface Project {
  upvotes: {
    staff: number
    veterans: number
  }
  downvotes: {
    staff: number
    veterans: number
  }
  approved: boolean
  rejected: boolean
  id: Discord.Snowflake
  name: string
  author: Discord.Snowflake
  description: string
  tech: string
  links: {
    source: string
    other: string
  }
  paused?: boolean
}

export interface VoteResult {
  success: boolean
  wasApproved?: boolean
  wasRejected?: boolean
  wasPaused?: boolean
  reason: string
  project: Project | undefined
}

export interface ShowcaseInput {
  result: VoteResult
  isPause: boolean
}

export interface ShowcaseDiscordInput {
  guild: Discord.Guild
  channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel
  user: Discord.User
  reaction: Discord.MessageReaction
}
