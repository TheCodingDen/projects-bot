import { Snowflake } from 'discord.js'

interface RejectionTemplateParams { user: Snowflake, name: string }
// TODO: validate that the config matches a certain shape

const descriptions = [
  { name: 'No license', value: 'no-license' },
  { name: 'Invalid license (Non OSI / not immediately visible)', value: 'invalid-license' },
  { name: 'Inaccessable repository', value: 'inaccessable-repository' },
  { name: 'Empty repository', value: 'empty-repository' },
  { name: 'Invalid link (Not GitHub or GitLab)', value: 'invalid-repository' },
  { name: 'Invalid user ID', value: 'invalid-id' },
  { name: 'Plagiarism', value: 'plagiarism' },
  { name: 'Advertisement', value: 'ad' }
] as const

const config = {
  rejection: {
    // A whitelist of reasons we send to public review instead of thread
    reviewWhitelist: ['invalid-id'],
    templates: {
      'no-license': ({ user }: RejectionTemplateParams) => `<@${user}>, your project has been rejected because does not contain a valid LICENSE, LICENSE.txt or LICENSE.md file. Please add a license to your project and resubmit. See <https://choosealicense.com/> for more information`,
      'invalid-license': ({ user }: RejectionTemplateParams) => `<@${user}>, your project has been rejected because it contains a non-OSI license or the license is not immediately visible in the root of the project. Please use an OSI license in a file called LICENSE, LICENSE.txt or LICENSE.md and resubmit. See <https://choosealicense.com/> for more information.`,
      'inaccessable-repository': ({ user }: RejectionTemplateParams) => `<@${user}>, your project has been rejected because the provided repository link could not be accessed. Please double check the URL, privacy settings and account information, then resubmit.`,
      'empty-repository': ({ user }: RejectionTemplateParams) => `<@${user}>, your project has been rejected because the provided repository was empty. Please double check the URL and account information, then resubmit.`,
      'invalid-repository': ({ user }: RejectionTemplateParams) => `<@${user}>, your project has been rejected because the provided link did not point to a valid GitHub or GitLab repository. Please double check the URL and account information, then resubmit.`,
      'invalid-id': ({ name }: RejectionTemplateParams) => `To whomever submitted "${name}", the provided ID was invalid. You must resubmit with a valid user ID for your project to be reviewed. For help with getting your ID, see <https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID->`,
      plagiarism: ({ user }: RejectionTemplateParams) => `<@${user}>, your project has been rejected because it is blatant plagiarism. Do not resubmit and do not submit plagiarised projects again.`,
      ad: ({ user }: RejectionTemplateParams) => `<@${user}>, your project has been rejected because it is an advertisement to another service / platform. This goes against our policy on advertisements <https://docs.thecodingden.net/community-policy-center/rules#ads>. Do not resubmit this project.`
    } as const,
    descriptions
  },
  help: {
    // Intentionally left blank. If we need to specify extra help for a command, it can go here.
    commands: {
      edit: '',
      reject: '',
      help: 'When ran without a command, the help is provided as an ephemeral message.',
      create: ''
    },
    general:
`
**General**
  ⮞ Applying the final vote on a project (in accordance with the voting thresholds) will action that and remove it from <#813496732901965924>


**Threads**
__Review threads__
  ⮞ Automatically created by the bot on submission
  ⮞ Should be reopened if they automatically archive and the project has not been processed

__Rejection threads__
  ⮞ Must be manually created
  ⮞ Must be titled "PROJECT_NAME"
  ⮞ Must be set to "Private"
  ⮞ Notify a staff member if anything goes wrong with creation
  ⮞ May mention any relevant reviewers
      
  ⮞ May link directly to the repository
  ⮞ May state resubmission guidance if applicable


**Instant rejection**
  Projects may be instantly rejected if they breach any of the following criteria:
${descriptions.map(d => `    ⮞ ${d.name}`).join('\n')}
  
  ⮞ Mention a staff member to action an instant rejection


**Submitting your own project**
You may submit your own project under the following terms:
  ⮞ You do not vote on your own project
  ⮞ You do not pre-emptively read feedback and make changes
  ⮞ You do not interfere with feedback


**Miscellaneous**
  ⮞ User mention format: \`<@ID>\`
  ⮞ You can assign reviewer roles through <#987102838171770972>


**Useful links**
  ⮞ Review guidelines: https://canary.discord.com/channels/172018499005317120/743463081199271966/76597609340862464
  ⮞ Voting thresholds: https://canary.discord.com/channels/172018499005317120/813496732901965924/813501831073890385
  ⮞ Valid license list: https://opensource.org/licenses/alphabetical
  ⮞ Choose a license: https://choosealicense.com/
`
  }
} as const

export type ValidRejectionKey = keyof typeof config.rejection.templates

export default config
