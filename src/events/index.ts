import { ClientEvents } from 'discord.js'
import ready from './ready'
import messageCreate from './message'
import messageReactionAdd from './messageReactionAdd'
import messageReactionRemove from './messageReactionRemove'

const events: { [key in keyof ClientEvents]?: Function } = {
  ready,
  messageCreate,
  messageReactionAdd,
  messageReactionRemove
}

export default events
