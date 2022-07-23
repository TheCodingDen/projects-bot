import { RelatedMessage } from '@prisma/client'
import { Message, MessageEmbed, MessageOptions, Snowflake, TextBasedChannel } from 'discord.js'
import { Err, Ok, Result } from 'ts-results'
import { Manager } from '.'
import { log } from '../utils/logger'

interface SubmissionBase {
  name: string
}

export interface NamedSubmission extends SubmissionBase {
  // this is optional so that if the API consumer only specifies the `name`, we
  // default to "not-relating" it to another message.
  shouldRelate?: false
}

export interface CanHaveRelatedMessages extends SubmissionBase {
  shouldRelate: true
  relatedMessages: RelatedMessage[]

  // The ID of the submission we are relating to
  id: Snowflake
}

export type NamedSubmissionOrRelated = NamedSubmission | CanHaveRelatedMessages

export class CommunicationManager extends Manager {
  /**
   * Safely send a message to a channel, optionally relating it to a submission.
   *
   * Ensures the sent message has `allowedMentions` set to empty.
   */
  async sendSafeMessage (
    message: string,
    channel: TextBasedChannel,
    relatedSubmission: NamedSubmissionOrRelated,
    options?: MessageOptions | MessageEmbed
  ): Promise<Result<Message, Error>> {
    // Explictly set allowedMentions to an empty object. If the options override this, take that instead.

    const msgRes = await Result.wrapAsync(async () =>
      await channel.send({
        content: message,
        allowedMentions: { parse: [] },
        ...options
      })
    )

    if (msgRes.err) {
      const err = msgRes.val

      log.error(`Failed to send message to channel ${channel.id}`)
      log.error(err)

      return Err(err as Error)
    }

    const sentMessage = msgRes.val

    // Compare to 'not false' as it's a nullable field because TS doesnt support interface defaults
    // So we cant easily default true. 'not false' implies true or undefined (we want to relate if undefined is passed)
    if (relatedSubmission.shouldRelate !== false) {
      // Make sure the prop is set as it could be undefined
      relatedSubmission.shouldRelate = true
      // Casting is ok because if 'shouldRelate' is true, the props are required
      // Catching errors isnt important, it's all logged
      void this.relateMessage(sentMessage.id, relatedSubmission as CanHaveRelatedMessages)
    }

    return Ok(sentMessage)
  }

  /**
   * Relate a message ID to a submission.
   */
  async relateMessage (message: Snowflake, relateTo: CanHaveRelatedMessages): Promise<Result<void, Error>> {
    if (!message.length || !relateTo.id.length) {
      return Err(new Error('Attempted to relate the provided message to a blank ID or blank message ID. If you are trying to send an independent message, set `shouldRelated` to `false` in the `relatedSubmission` param.'))
    }

    const msgRes = await this.client.db.exec(db => db.relatedMessage.create({
      data: {
        submissionId: relateTo.id,
        messageId: message
      }
    }))

    if (msgRes.err) {
      log.error(`Failed to relate message ${message} to ${relateTo.id}`)
      log.error(msgRes.val)

      // This means the DB rejected our request, there's something very wrong, abort
      return Err(msgRes.val)
    }

    const msg = msgRes.val

    relateTo.relatedMessages.push(msg)
    log.debug(`Pushed ${message} to the related messages of ${relateTo.id}, new state ${JSON.stringify(relateTo.relatedMessages)})`)

    return Ok.EMPTY
  }

  /**
   * Send a message to the configured log channel.
   */
  async sendToLogChannel (message: string, relatedSubmission: NamedSubmissionOrRelated, options?: MessageOptions | MessageEmbed): Promise<Result<Message, Error>> {
    return await this.sendSafeMessage(message, this.client.config.channels().privateLog, relatedSubmission, options)
  }

  /**
   * Send a warning to the configured submissions channel.
   */
  async reportWarning (message: string, relatedSubmission: NamedSubmissionOrRelated, options?: MessageOptions | MessageEmbed): Promise<Result<Message, Error>> {
    return await this.sendSafeMessage(`⚠️ ${message} (Submission: ${relatedSubmission.name})`, this.client.config.channels().privateSubmission, relatedSubmission, options)
  }

  /**
   * Send an error to the configured submissions channel.
   */
  async reportError (message: string, relatedSubmission: NamedSubmissionOrRelated, options?: MessageOptions | MessageEmbed): Promise<Result<Message, Error>> {
    return await this.sendSafeMessage(`❌ An error has occured: ${message} (Submission: ${relatedSubmission.name})`, this.client.config.channels().privateSubmission, relatedSubmission, options)
  }
}
