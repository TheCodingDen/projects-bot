import { URL } from 'url'
import { log } from '../utils/logger'

/**
 * Checks that the provided URL is valid, and returns it as a clickable link.
 */
export default (url: string): string => {
  try {
    return `[View on ${new URL(url).hostname}](${url})`
  } catch (err) {
    log.warn(`Could not parse URL from source ${url}`)
    log.warn(err)
    return url
  }
}
