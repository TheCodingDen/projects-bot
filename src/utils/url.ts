export function createClickableURLString (url: string): string {
  try {
    return `[View on ${new URL(url).hostname}](${url})`
  } catch (err) {
    logger.warn(`Could not parse URL from source ${url}`)
    logger.warn(err)
    return url
  }
}
