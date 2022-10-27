import { EmbedBuilder } from '@discordjs/builders'
import assert from 'assert'
import { APIEmbed, Message } from 'discord.js'
import config from '../config'
import {
  ApiSubmission,
  CompletedSubmission,
  PendingSubmission,
  Submission,
  ValidatedSubmission
} from '../types/submission'
import { stringify } from './stringify'
import { createClickableURLString } from './url'

const DEFAULT_AVATAR_URL = 'https://cdn.discordapp.com/embed/avatars/0.png'
const ZWS = '​'

const EMPTY_FIELD = {
  name: ZWS,
  value: ZWS,
  inline: true
}

export function createEmbed (submission: Submission): APIEmbed {
  logger.debug(
    `Creating embed for submission ${stringify.submission(submission)}`
  )
  if (submission.state === 'RAW') {
    return createInitialEmbed(submission)
  }

  if (submission.state === 'PAUSED' || submission.state === 'PROCESSING') {
    return createProcessingEmbed(submission)
  }

  if (submission.state === 'ERROR' || submission.state === 'WARNING') {
    return createPendingEmbed(submission)
  }

  if (submission.state === 'ACCEPTED') {
    return createPublicEmbed(submission)
  }

  throw new Error(`Unknown state ${submission.state}`)
}

function createEmbedBase (
  submission: ApiSubmission | PendingSubmission | ValidatedSubmission
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(submission.name)
    .setFields(
      {
        name: 'Source',
        value: submission.links.source
      },
      {
        name: 'Technologies',
        value: submission.tech,
        inline: true
      },
      {
        name: 'Other links',
        value: submission.links.other,
        inline: true
      }
    )
    .setDescription(submission.description)
    .setColor(config.colours().embedState[submission.state])
    .setTimestamp(new Date())
}

function getReplitURL (source: string): string {
  const url = new URL(source)

  // No / after github because pathname includes that slash
  return `https://repl.it/github${url.pathname}`
}

function createPublicEmbed (submission: CompletedSubmission): APIEmbed {
  // Author must exist for us to publish, but it might not exist in other contexts, thus is optional
  assert(submission.author !== undefined, 'author was not set')

  return new EmbedBuilder()
    .setTitle(submission.name)
    .setDescription(submission.description)
    .setURL(submission.links.source)
    .setTimestamp(new Date())
    .setAuthor({
      name: submission.author.user.tag,
      iconURL: submission.author.avatarURL() ?? DEFAULT_AVATAR_URL
    })
    .setFields(
      { name: 'Languages/technologies used', value: submission.tech },
      {
        name: 'Source',
        value: createClickableURLString(submission.links.source),
        inline: true
      },
      { name: 'Other links', value: submission.links.other, inline: true },
      {
        name: 'Open in Replit',
        value: `[Click here](${getReplitURL(submission.links.source)})`,
        inline: true
      }
    )
    .setColor(config.colours().publicEmbed)
    .toJSON()
}

function createInitialEmbed (submission: ApiSubmission): APIEmbed {
  return createEmbedBase(submission)
    .setFields(
      {
        name: 'Submitter',
        value: `Unknown#0000 (${submission.authorId})`
      },
      {
        name: 'Source',
        value: submission.links.source
      },
      {
        name: 'Technologies',
        value: submission.tech,
        inline: true
      },
      {
        name: 'Other links',
        value: submission.links.other,
        inline: true
      },
      EMPTY_FIELD,
      {
        name: 'Upvotes',
        value: 'None',
        inline: true
      },
      {
        name: 'Downvotes',
        value: 'None',
        inline: true
      },
      EMPTY_FIELD
    )
    .toJSON()
}

function createProcessingEmbed (submission: ValidatedSubmission): APIEmbed {
  const upvotes = submission.votes
    .filter((v) => v.type === 'UPVOTE')
    .map((v) => `${v.voter.user.tag}`)
    .join('\n') || 'None'

  const downvotes = submission.votes
    .filter((v) => v.type === 'DOWNVOTE')
    .map((v) => `${v.voter.user.tag}`)
    .join('\n') || 'None'

  return createEmbedBase(submission)
    .setFields(
      {
        name: 'Submitter',
        value: `<@${submission.author.id}> (${submission.author.user.tag}) (${submission.authorId})`
      },
      {
        name: 'Source',
        value: submission.links.source
      },
      {
        name: 'Technologies',
        value: submission.tech,
        inline: true
      },
      {
        name: 'Other links',
        value: submission.links.other,
        inline: true
      },
      EMPTY_FIELD,
      {
        name: 'Upvotes',
        value: upvotes,
        inline: true
      },
      {
        name: 'Downvotes',
        value: downvotes,
        inline: true
      },
      EMPTY_FIELD
    )
    .setFooter({
      text: `id: ${submission.id}`
    })
    .setTimestamp(submission.submittedAt)
    .toJSON()
}

function createPendingEmbed (submission: PendingSubmission): APIEmbed {
  return createEmbedBase(submission)
    .setFields(
      {
        name: 'Submitter',
        value: `Unknown#0000 (${submission.authorId})`
      },
      {
        name: 'Source',
        value: submission.links.source
      },
      {
        name: 'Technologies',
        value: submission.tech,
        inline: true
      },
      {
        name: 'Other links',
        value: submission.links.other,
        inline: true
      },
      EMPTY_FIELD,
      {
        name: 'Upvotes',
        value: 'None',
        inline: true
      },
      {
        name: 'Downvotes',
        value: 'None',
        inline: true
      },
      EMPTY_FIELD
    )
    .setFooter({
      text: `id: ${submission.id}`
    })
    .setTimestamp(submission.submittedAt)
    .toJSON()
}

export async function updateMessage (
  message: Message,
  apiEmbed: APIEmbed
): Promise<Message> {
  return await message.edit({
    embeds: [apiEmbed]
  })
}
