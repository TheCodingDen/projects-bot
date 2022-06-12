// Parses the Google Forms embed to a more malleable data structure

import Discord from 'discord.js'
import { ProjectSubmission } from '../typings/interfaces'

export default (message: Discord.Message): ProjectSubmission => {
  const embed = message.embeds[0]
  const { fields } = embed

  let fieldMap

  try {
    if (!process.env.GOOGLE_FORMS_WEBHOOK_FIELD_MAP) throw new Error('field map not set')
    fieldMap = JSON.parse(process.env.GOOGLE_FORMS_WEBHOOK_FIELD_MAP)
  } catch (err) {
    throw new Error(`Google Forms webhook field map ${(err as Error).message === 'field map not set' ? 'not set' : 'has invalid format'}`)
  }

  if (fields.length !== fieldMap.length) throw new Error(`Field amount mismatch; expected ${fieldMap.length}, got ${fields.length}`)

  return {
    id: message.id,
    // The else will never happen here as the title is a required argument on all levels; this is just here to satisfy TS
    name: embed.title ?? 'Untitled',
    author: fields[fieldMap.indexOf('author')].value,
    description: fields[fieldMap.indexOf('description')].value,
    links: {
      source: fields[fieldMap.indexOf('links.source')].value,
      other: fields[fieldMap.indexOf('links.other')].value
    },
    tech: fields[fieldMap.indexOf('tech')].value
  }
}
