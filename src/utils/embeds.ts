import Discord, { User } from 'discord.js'
import createClickableNameForURL from '../utils/sourceUrl'
import { Submission } from '../models/submission'
import { URL } from 'url'
import { IncomingSubmissionData } from '../models/schema/submission'
import { Command } from '../managers/commands'
import config from '../config'

const getReplitURL = (source: string): string => {
  const url = new URL(source)

  // No / after github because pathname includes that slash
  return `https://repl.it/github${url.pathname}`
}

const publicShowcase = (project: Submission): Discord.MessageEmbed => {
  const author = project.author
  const name = author.tag

  return new Discord.MessageEmbed({
    title: project.name,
    description: project.description,
    url: project.links.source,
    timestamp: new Date(),
    color: 0x4A90E2,
    author: {
      name,
      iconURL: author.avatarURL() ?? 'https://cdn.discordapp.com/embed/avatars/0.png'
    },
    fields: [
      { name: 'Languages/technologies used', value: project.techUsed },
      { name: 'Source', value: createClickableNameForURL(project.links.source), inline: true },
      { name: 'Other links', value: project.links.other, inline: true },
      { name: 'Open in Replit', value: `[Click here](${getReplitURL(project.links.source)})`, inline: true }
    ]
  })
}

const privateSubmission = (project: IncomingSubmissionData, author: User): Discord.MessageEmbed => {
  return new Discord.MessageEmbed({
    title: project.name,
    description: project.description,
    timestamp: new Date(),
    color: 0x7289DA,
    fields: [
      { name: 'Submitter', value: `<@!${author.id}> (${author.tag}, ${author.id})` },
      { name: 'Source', value: project.links.source },
      { name: 'Technologies used', value: project.tech },
      { name: 'Other links', value: project.links.other }
    ]
  })
}

const commandHelp = (command: Command): Discord.MessageEmbed => {
  // Casting is safe because the names are known
  // undefined case is handled anyways
  const details = config.help.commands[command.name as keyof typeof config.help.commands] || 'No extra details found'

  const description =
`
**Description:** ${command.description}

**Permission level:** ${command.permissionLevel.toUpperCase()}

**Command details:**: ${details}
`

  return new Discord.MessageEmbed({
    title: `Help for command ${command.name}`,
    description,
    timestamp: new Date(),
    color: 0x7289DA
  })
}

const generalHelp = (): Discord.MessageEmbed => {
  return new Discord.MessageEmbed({
    title: 'How to use Projects Showcase',
    description: config.help.general,
    timestamp: new Date(),
    color: 0x7289DA
  })
}

export const embeds = {
  privateSubmission,
  publicShowcase,
  commandHelp,
  generalHelp
} as const
