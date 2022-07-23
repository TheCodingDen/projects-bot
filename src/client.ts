import { Client, ClientOptions } from 'discord.js'
import { CommandsManager } from './managers/commands'
import { CommunicationManager } from './managers/communication'
import { ConfigManager } from './managers/config'
import { DatabaseManager } from './managers/database'
import { SubmissionsManager } from './managers/submissions'
import { VoteManager } from './managers/votes'

export class ProjectsClient extends Client {
  public readonly submissions: SubmissionsManager
  public readonly db: DatabaseManager
  public readonly config: ConfigManager
  public readonly communication: CommunicationManager
  public readonly votes: VoteManager
  public readonly commands: CommandsManager

  constructor (opts: ClientOptions) {
    super(opts)

    this.submissions = new SubmissionsManager(this)
    this.db = new DatabaseManager(this)
    this.config = new ConfigManager(this)
    this.communication = new CommunicationManager(this)
    this.votes = new VoteManager(this)
    this.commands = new CommandsManager(this)
  }
}
