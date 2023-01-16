import { GuildMember, PartialGuildMember } from 'discord.js'
import { privateLog } from '../communication/private'
import config from '../config'
import {
  fetchDiscordIdsForSubmission,
  fetchSubmissionsByMemberId,
  updateSubmissionState
} from '../db/submission'
import { runCatching } from '../utils/request'
import { stringify } from '../utils/stringify'

export async function handleMemberLeaveEvent (
  member: GuildMember | PartialGuildMember
): Promise<void> {
  const submissions = await fetchSubmissionsByMemberId(member.id)

  for (const submission of submissions) {
    // When we migrated old data into the project, we had to use FAKEID[{cuid}] for snowflake values, as they were unknown
    // This means we must handle this case when members who previously submitted projects leave the guild
    // This should never happen as `fetchSubmissionsByMemberId` will filter out ACCEPTED | DENIED submissions
    // But we would rather check it, for sanity
    if (submission.id.startsWith('FAKEID')) {
      logger.info(`Not attempting to reject migrated submission ${stringify.submission(submission)} (guild member left)`)
      continue
    }

    const { reviewThreadId, submissionMessageId } =
      await fetchDiscordIdsForSubmission(submission)

    if (!reviewThreadId || !submissionMessageId) {
      logger.info('No IDs set for automated rejection (guild member left)')
      return
    }

    // Supress these errors so that we can update the state and log later on
    const { privateSubmissions } = config.channels()
    const reviewThread = await runCatching(
      async () => await privateSubmissions.threads.fetch(reviewThreadId),
      'suppress'
    )

    if (!reviewThread) {
      logger.info('reviewThread was null (guild member left)')
    }

    const submissionMessage = await runCatching(
      async () => await privateSubmissions.messages.fetch(submissionMessageId),
      'suppress'
    )

    await reviewThread?.setArchived(true)
    await submissionMessage?.delete()

    await updateSubmissionState(submission, 'DENIED')

    privateLog.info({
      type: 'text',
      content: 'Silently rejected submission because author left the guild.',
      ctx: submission
    })
  }
}
