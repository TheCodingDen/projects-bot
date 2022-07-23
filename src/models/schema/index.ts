import json from 'joi'

// Snowflakes
export const SNOWFLAKE_REGEX = /^(\d*)$/
export const SNOWFLAKE_VALIDATOR = json.string().pattern(SNOWFLAKE_REGEX, 'snowflake').min(1).max(20)

// Lengths
export const DESCRIPTION_MAX_LENGTH = 1000
// 256 as per the max length for Discord embed titles
export const NAME_MAX_LENGTH = 256
export const EXTRA_INFO_MAX_LENGTH = 200
