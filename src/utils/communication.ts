/**
 * The default message options for a discord.js message.
 * This disables mentions and makes the reply ephemeral.
 */
export const DEFAULT_MESSAGE_OPTS_DJS = {
  // Allow no mentions to ping by default
  allowedMentions: { parse: [] },

  // Most logs are sent just to the user, so make it default
  ephemeral: true
}

/**
 * The default message options for a slash-create message.
 * This disables mentions and makes the reply ephemeral.
 */
export const DEFAULT_MESSAGE_OPTS_SLASH = {
  // Allow no mentions to ping by default
  allowedMentions: { everyone: false, users: false, roles: false },

  // Most logs are sent just to the user, so make it default
  ephemeral: true
}
