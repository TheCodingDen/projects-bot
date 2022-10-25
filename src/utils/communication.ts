export const DEFAULT_MESSAGE_OPTS_DJS = {
  // Allow no mentions to ping by default
  allowedMentions: { parse: [] },

  // Most logs are sent just to the user, so make it default
  ephemeral: true
}

export const DEFAULT_MESSAGE_OPTS_SLASH = {
  // Allow no mentions to ping by default
  allowedMentions: { everyone: false, users: false, roles: false },

  // Most logs are sent just to the user, so make it default
  ephemeral: true
}
