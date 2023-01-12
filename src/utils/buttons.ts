import { ButtonBuilder, ButtonStyle } from 'discord.js'
import config from '../config'
const emojis = config.emojis().button

/**
 * The buttons used for voting.
 */
export const VOTING_BUTTONS = [
  new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Upvote')
    .setCustomId('upvote')
    .setEmoji(emojis.upvote),
  new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Downvote')
    .setCustomId('downvote')
    .setEmoji(emojis.downvote),
  new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Pause')
    .setCustomId('pause')
    .setEmoji(emojis.pause)
] as const
