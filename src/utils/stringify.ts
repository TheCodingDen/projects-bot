import { GuildBasedChannel, User as DjsUser } from 'discord.js'
import { User as SlashCreateUser } from 'slash-create'
import { Draft } from '../types/draft'
import {
  AnySubmission,
  isPending,
  isRaw,
  isValidated
} from '../types/submission'
import { Vote } from '../types/vote'

/**
 * Stringification utility functions for our object.
 * This avoids the requirement to bolt on toString implementations to our interfaces.
 */
export const stringify = {
  submission: (submission: AnySubmission | undefined): string => {
    if (submission === undefined) {
      return 'Submission { undefined }'
    }

    const base = `${submission.name} (author: ${submission.authorId})}`

    if (isRaw(submission)) {
      // RawSubmission
      return `Submission(RAW) { ${base} }`
    } else if (isValidated(submission)) {
      // ValidatedSubmission
      return `Submission(${submission.state}) { ${base} (id: ${submission.id}) (submissionMessageId: ${submission.submissionMessage.id}) (reviewThreadId: ${submission.reviewThread.id}) }`
    } else if (isPending(submission)) {
      // PendingSubmission

      // Don't log "ERROR" because coralogix will interpret this as an actual error log
      // and dispatch an alert etc.
      const loggedState = submission.state === 'ERROR' ? 'INVALID' : 'WARNING'

      return `Submission(${loggedState}) { ${base} }`
    } else if (
      submission.state === 'ACCEPTED' ||
      submission.state === 'DENIED'
    ) {
      // CompletedSubmission
      return `Submission(${submission.state}) { ${base} }`
    }

    throw new Error(`Invalid state ${submission.state}`)
  },

  vote: (vote: Vote | undefined): string => {
    if (vote === undefined) {
      return 'Vote { undefined }'
    }

    return `Vote { (role: ${vote.role}) (type: ${vote.type}) (voter: ${vote.voter.id}) }`
  },

  user: (user: DjsUser | SlashCreateUser | undefined): string => {
    if (user === undefined) {
      return 'User { undefined }'
    }

    return `User { (id: ${user.id}) (tag: ${user.username}#${user.discriminator})}`
  },

  channel: (channel: GuildBasedChannel | undefined | null): string => {
    if (channel === undefined || channel === null) {
      return 'Channel { undefined }'
    }

    return `Channel { (id: ${channel.id}) (name: ${channel.name}) (type: ${channel.type}) (guildId: ${channel.guildId})}`
  },

  draft: (draft: Draft | undefined): string => {
    if (draft === undefined) {
      return 'Draft { undefined }'
    }

    return `Draft { (id: ${draft.id}) (author: ${
      draft.author.id
    }) (timestamp: ${draft.timestamp.toLocaleString()})}`
  }
}
