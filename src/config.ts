import * as env from './utils/env'

// User mention and submission name
interface RejectionParams { user: string, name: string }

type LogLocation = 'public' | 'thread' | 'none'

export interface RejectionTemplate {
  // The unique key used to identify the template
  key: string

  // The value sent to Discord for the enumeration
  // 'value' should be identical to 'key'
  enumValue: { name: string, value: string }

  // The pretty value, for logging
  prettyValue: string

  // The templating function to create the rejection message
  execute: (params: RejectionParams) => string

  // The function to decide where to send the log
  location: () => LogLocation
}

const rejectionValues: RejectionTemplate[] = [
  {
    key: 'no-license',
    enumValue: { name: 'No license', value: 'no-license' },
    prettyValue: 'No license',
    execute: ({ user }: RejectionParams) => `${user}, your project has been rejected because it does not contain a valid LICENSE, LICENSE.txt or LICENSE.md file. Please add a license to your project and then resubmit. See <https://choosealicense.com/> for more information`,
    location: () => 'thread'
  },
  {
    key: 'invalid-license',
    enumValue: { name: 'Invalid license (Non OSI / not immediately visible)', value: 'invalid-license' },
    prettyValue: 'Invalid license',
    execute: ({ user }: RejectionParams) => `${user}, your project has been rejected because it contains a non-OSI license or the license is not immediately visible in the root of the project. Please use an OSI license in a file called LICENSE, LICENSE.txt or LICENSE.md and resubmit. See <https://choosealicense.com/> for more information.`,
    location: () => 'thread'
  },
  {
    key: 'inaccessable-repository',
    enumValue: { name: 'Inaccessable repository', value: 'inaccessable-repository' },
    prettyValue: 'Inaccessable repository',
    execute: ({ user }: RejectionParams) => `${user}, your project has been rejected because the provided repository link could not be accessed. Please double check the URL, privacy settings and account information, then resubmit.`,
    location: () => 'thread'
  },
  {
    key: 'empty-repository',
    enumValue: { name: 'Empty repository', value: 'empty-repository' },
    prettyValue: 'Empty repository',
    execute: ({ user }: RejectionParams) => `${user}, your project has been rejected because the provided repository was empty. Please double check the URL and account information, then resubmit.`,
    location: () => 'thread'
  },
  {
    key: 'invalid-repository',
    enumValue: { name: 'Invalid link (Not GitHub or GitLab)', value: 'invalid-repository' },
    prettyValue: 'Invalid repository',
    execute: ({ user }: RejectionParams) => `${user}, your project has been rejected because the provided link did not point to a valid GitHub or GitLab repository. Please double check the URL and account information, then resubmit`,
    location: () => 'thread'
  },
  {
    key: 'invalid-id',
    enumValue: { name: 'Invalid user ID', value: 'invalid-id' },
    prettyValue: 'Invalid user ID',
    execute: ({ name }: RejectionParams) => `To whoever submitted "${name}", the provided ID was invalid. Please provide us with your ID so we can process your submission. For help with getting your ID, see <https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID->`,
    location: () => 'public'
  },
  {
    key: 'plagiarism',
    enumValue: { name: 'Plagiarism', value: 'plagiarism' },
    prettyValue: 'Plagiarism',
    execute: ({ user }: RejectionParams) => `${user}, your project has been rejected because it is blatant plagiarism. Do not resubmit and do not submit plagiarised projects again.`,
    location: () => 'thread'
  },
  {
    key: 'ad',
    enumValue: { name: 'Advertisement', value: 'ad' },
    prettyValue: 'Advertisement',
    execute: ({ user }: RejectionParams) => `${user}, your project has been rejected because it is an advertisement to another service / platform. This goes against our policy on advertisements <https://docs.thecodingden.net/community-policy-center/rules#ads>. Do not resubmit this project.`,
    location: () => 'thread'
  },
  {
    key: 'silently',
    enumValue: { name: 'Silently (Will not send a thread message)', value: 'silently' },
    prettyValue: 'Silently',
    // Should not be called, this should not be logged
    execute: (_: RejectionParams) => {
      throw new Error('Uncallable')
    },
    location: () => 'none'
  },
  {
    key: 'duplicate',
    enumValue: { name: 'Duplicate submission', value: 'duplicate' },
    prettyValue: 'Duplicate',
    execute: ({ user }: RejectionParams) => `${user}, your project has been rejected because it is a duplicate. We will review your original in due course. Please do not submit this project again.`,
    location: () => 'thread'
  }
]

const config = {
  /**
   * Config for the forceful rejection feature.
   */
  rejection: () => ({
    /**
     * The enum values to use in the /reject slash command.
     */
    enumValues: rejectionValues.map(rej => rej.enumValue),

    /**
     * Utility to lookup a template by its `key`
     */
    lookupByKey: (key: string) => {
      return rejectionValues.find(rej => rej.key === key)
    }
  }),
  /**
   * Config for the backend API
   */
  api: () => ({
    port: env.number('PORT'),
    key: env.string('API_AUTH_KEY')
  }),
  /**
   * Config for the active guilds in the bot.
   */
  guilds: () => ({
    current: env.guild(process.env.NODE_ENV === 'production' ? 'MAIN_GUILD_ID' : 'DEVELOPMENT_GUILD_ID')
  }),
  /**
   * Config for the active channels in the bot.
   */
  channels: () => ({
    privateSubmissions: env.textChannel('PRIVATE_SUBMISSION_CHANNEL'),
    privateLogs: env.textChannel('PRIVATE_LOG_CHANNEL'),
    publicLogs: env.textChannel('PUBLIC_LOG_CHANNEL'),
    internalLogs: env.textChannel('INTERNAL_LOG_CHANNEL'),
    publicShowcase: env.textChannel('PUBLIC_SHOWCASE_CHANNEL'),

    feedbackThreadChannel: env.textChannel('FEEDBACK_THREAD_CHANNEL')
  }),
  /**
   * Config for the active roles in the bot.
   */
  roles: () => ({
    veterans: env.role('VETERANS_ROLE_ID', env.guild(process.env.NODE_ENV === 'production' ? 'MAIN_GUILD_ID' : 'DEVELOPMENT_GUILD_ID')),
    staff: env.role('STAFF_ROLE_ID', env.guild(process.env.NODE_ENV === 'production' ? 'MAIN_GUILD_ID' : 'DEVELOPMENT_GUILD_ID'))
  }),
  /**
   * Config for the voting system.
   */
  vote: () => ({
    threshold: env.number('VOTING_THRESHOLD')
  }),
  /**
   * Config to hold the emojis used throughout the bot.
   */
  emojis: () => ({
    button: {
      upvote: '⬆️',
      downvote: '⬇️',
      pause: '⏸️',
      clearWarnings: '❎'
    },
    log: {
      info: '🟢',
      warning: '🟡',
      error: '🔴'
    }
  }),
  /**
   * Config to hold the colour codes used throughout the bot
   */
  colours: () => ({
    embedState: {
      ERROR: 0XFF7878,
      WARNING: 0XE5EBB2,
      PAUSED: 0XF8C4B4,
      PROCESSING: 0X90C8AC,
      RAW: 0X90C8AC
    },
    log: {
      info: 0X90C8AC,
      warning: 0XE5EBB2,
      error: 0XFF7878,

      accepted: 0X08FF08,
      pause: 0XCCFF00,
      denied: 0XD41920
    },
    publicEmbed: 0x4A90E2
  }),
  /**
   * Config for using the GitHub API in the bot.
   *
   */
  github: () => ({
    token: env.string('GITHUB_API_TOKEN')
  })
}

export default config
