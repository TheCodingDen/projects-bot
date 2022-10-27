import * as env from './utils/env'

// User mention and submission name
interface RejectionParams { user: string, name: string }

const config = {
  rejection: () => ({
    enumValues: [
      { name: 'No license', value: 'no-license' },
      { name: 'Invalid license (Non OSI / not immediately visible)', value: 'invalid-license' },
      { name: 'Inaccessable repository', value: 'inaccessable-repository' },
      { name: 'Empty repository', value: 'empty-repository' },
      { name: 'Invalid link (Not GitHub or GitLab)', value: 'invalid-repository' },
      { name: 'Invalid user ID', value: 'invalid-id' },
      { name: 'Plagiarism', value: 'plagiarism' },
      { name: 'Advertisement', value: 'ad' }
    ],
    logLookup: {
      'no-license': 'No license',
      'invalid-license': 'Invalid license',
      'inaccessable-repository': 'Inaccessable repository',
      'empty-repository': 'Empty repository',
      'invalid-repository': 'Invalid repository',
      'invalid-id': 'Invalid user ID',
      plagiarism: 'Plagiarism',
      ad: 'Advertisement'
    },
    templates: {
      'no-license': ({ user }: RejectionParams) => `${user}, your project has been rejected because does not contain a valid LICENSE, LICENSE.txt or LICENSE.md file. Please add a license to your project and let us know so we can process your submission. See <https://choosealicense.com/> for more information`,
      'invalid-license': ({ user }: RejectionParams) => `${user}, your project has been rejected because it contains a non-OSI license or the license is not immediately visible in the root of the project. Please use an OSI license in a file called LICENSE, LICENSE.txt or LICENSE.md and then let us know so we can process your submission. See <https://choosealicense.com/> for more information.`,
      'inaccessable-repository': ({ user }: RejectionParams) => `${user}, your project has been rejected because the provided repository link could not be accessed. Please double check the URL, privacy settings and account information, then provide us with a URL so we can process your submission.`,
      'empty-repository': ({ user }: RejectionParams) => `${user}, your project has been rejected because the provided repository was empty. Please double check the URL and account information, then provide us with a URL so we can process your submission.`,
      'invalid-repository': ({ user }: RejectionParams) => `${user}, your project has been rejected because the provided link did not point to a valid GitHub or GitLab repository. Please double check the URL and account information, then provide us with a URL so we can process your submission.`,
      'invalid-id': ({ name }: RejectionParams) => `To whomever submitted "${name}", the provided ID was invalid. Please provide us with your ID so we can process your submission. For help with getting your ID, see <https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID->`,
      plagiarism: ({ user }: RejectionParams) => `${user}, your project has been rejected because it is blatant plagiarism. Do not resubmit and do not submit plagiarised projects again.`,
      ad: ({ user }: RejectionParams) => `${user}, your project has been rejected because it is an advertisement to another service / platform. This goes against our policy on advertisements <https://docs.thecodingden.net/community-policy-center/rules#ads>. Do not resubmit this project.`
    }
  }),
  api: () => ({
    port: env.number('PORT')
  }),
  guilds: () => ({
    current: env.guild(process.env.NODE_ENV === 'production' ? 'MAIN_GUILD_ID' : 'DEVELOPMENT_GUILD_ID')
  }),
  channels: () => ({
    privateSubmissions: env.textChannel('PRIVATE_SUBMISSION_CHANNEL'),
    privateLogs: env.textChannel('PRIVATE_LOG_CHANNEL'),
    publicLogs: env.textChannel('PUBLIC_LOG_CHANNEL'),
    internalLogs: env.textChannel('INTERNAL_LOG_CHANNEL'),
    publicShowcase: env.textChannel('PUBLIC_SHOWCASE_CHANNEL')
  }),
  roles: () => ({
    veterans: env.role('VETERANS_ROLE_ID', env.guild(process.env.NODE_ENV === 'production' ? 'MAIN_GUILD_ID' : 'DEVELOPMENT_GUILD_ID')),
    staff: env.role('STAFF_ROLE_ID', env.guild(process.env.NODE_ENV === 'production' ? 'MAIN_GUILD_ID' : 'DEVELOPMENT_GUILD_ID'))
  }),
  vote: () => ({
    threshold: env.number('VOTING_THRESHOLD')
  }),
  emojis: () => ({
    button: {
      upvote: '👍',
      downvote: '👎',
      pause: '⏸️',
      clearWarnings: '❎'
    },
    log: {
      info: '🟢',
      warning: '🟡',
      error: '🔴'
    }
  }),
  colours: () => ({
    embedState: {
      ERROR: 0XFF7878,
      WARNING: 0XE5EBB2,
      PAUSED: 0XF8C4B4,
      PROCESSING: 0X90C8AC,
      RAW: 0X90C8AC
    },
    publicEmbed: 0x4A90E2
  })
}

export default config
