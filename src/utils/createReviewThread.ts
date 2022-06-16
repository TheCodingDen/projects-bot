import { Client, Message } from 'discord.js'
import { ProjectSubmission } from '../typings/interfaces'
import safeSendMessage from './safeSendMessage'

function createReviewContent (submission: ProjectSubmission): string {
  return `
**${submission.name}**

${submission.description}

Creator: ${submission.author} <@!${submission.author}>
Sources: <${submission.links.source}>
Other: ${submission.links.other}
`
}

export default async (submission: ProjectSubmission, submissionMessage: Message, client: Client): Promise<void> => {
  const content = createReviewContent(submission)

  const thread = await submissionMessage.startThread({
    name: submission.name
  })

  void await safeSendMessage(thread, content)
}
