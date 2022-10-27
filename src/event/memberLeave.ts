import { GuildMember, PartialGuildMember } from 'discord.js'
import { privateLog } from '../communication/private'
import config from '../config'
import {
  fetchDiscordIdsForSubmission,
  fetchSubmissionsByMemberId,
  updateSubmissionState
} from '../db/submission'

export async function handleMemberLeaveEvent (
  member: GuildMember | PartialGuildMember
): Promise<void> {
  const submissions = await fetchSubmissionsByMemberId(member.id)

  for (const submission of submissions) {
    const { reviewThreadId, submissionMessageId } =
      await fetchDiscordIdsForSubmission(submission)

    if (!reviewThreadId || !submissionMessageId) {
      logger.info('No IDs set for automated rejection (guild member left)')
      return
    }

    const { privateSubmissions } = config.channels()
    const reviewThread = await privateSubmissions.threads.fetch(reviewThreadId)

    if (!reviewThread) {
      logger.info('reviewThread was null (guild member left)')
      return
    }

    const submissionMessage = await privateSubmissions.messages.fetch(
      submissionMessageId
    )

    await reviewThread.setArchived(true)
    await submissionMessage.delete()

    await updateSubmissionState(submission, 'DENIED')
    privateLog.info(
      'Silently rejected submission because author left the guild.',
      submission
    )
  }
}
