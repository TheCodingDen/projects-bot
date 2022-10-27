/**
 * Create a clickable URL string for the given raw URl.
 * This also validates the URL to ensure it is a valid URL.
 */
export function createClickableURLString (url: string): string {
  try {
    return `[View on ${new URL(url).hostname}](${url})`
  } catch (err) {
    logger.warn(`Could not parse URL from source ${url}`)
    logger.warn(err)
    return url
  }
}
