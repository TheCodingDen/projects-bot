import { Awaitable, ClientEvents } from 'discord.js'
import ready from './ready'
import messageReactionAdd from './messageReactionAdd'
import messageReactionRemove from './messageReactionRemove'
import { ProjectsClient } from '../client'
import { Result } from 'ts-results'

type Events = { [key in keyof ClientEvents]?: (client: ProjectsClient, ...args: any[]) => Awaitable<Result<void, Error>> }
const events: Events = {
  ready,
  messageReactionAdd,
  messageReactionRemove
}

export default events
