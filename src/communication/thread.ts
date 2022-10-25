import { ThreadChannel } from 'discord.js'
import config from '../config'
import { DEFAULT_MESSAGE_OPTS_DJS } from '../utils/communication'
import { runCatching } from '../utils/request'

function genericLog (message: string, thread: ThreadChannel): void {
  runCatching(async () =>
    await thread.send({
      content: message,
      ...DEFAULT_MESSAGE_OPTS_DJS
    })
  )
}

const emojis = config.emojis().log
export const threadLog = {
  info: (message: string, thread: ThreadChannel) =>
    genericLog(`${emojis.info} ${message}`, thread),
  warning: (message: string, thread: ThreadChannel) =>
    genericLog(`${emojis.warning} ${message}`, thread),
  error: (message: string, thread: ThreadChannel) =>
    genericLog(`${emojis.error} ${message}`, thread)
}
