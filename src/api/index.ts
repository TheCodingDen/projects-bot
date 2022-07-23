import Koa, { Context } from 'koa'
import { IncomingMessage } from 'http'
import { log } from '../utils/logger'
import { ProjectsClient } from '../client'
import handleIncomingSubmission from './handleIncomingSubmission'
import { incomingSubmissionValidator } from '../models/schema/submission'
import { Err, Ok, Result } from 'ts-results'

/** Have we started the backend API yet? */
let hasStarted = false

/**
 * Construct a JSON string representing a backend error.
 */
function error (message: string): string {
  return JSON.stringify({
    error: true,
    message
  })
}

/**
 * Asynchronously read the body of a backend request as a string.
 */
async function readBody (req: IncomingMessage): Promise<Result<string, Error>> {
  const chunks = []

  // Using try/catch constructs rather than Result.wrap* because of the complexity
  // introduced by the for-await loop
  try {
    for await (const chunk of req) {
      chunks.push(chunk)
    }
  } catch (err) {
    // Cast is safe because node always throws Error or a subtype
    // and this is using exclusively node modules
    return Err(err as Error)
  }
  return Ok(Buffer.concat(chunks).toString())
}

/**
 * Validate whether an incoming request is auhenticated.
 */
function isAuthenticated (ctx: Context, auth: string): boolean {
  return auth === ctx.get('authentication')
}

/**
 * Ensure the backend API is able to start.
 */
function preRunChecks (): void {
  if (hasStarted) {
    throw new Error('Cannot start the API more than once')
  }

  hasStarted = true
}

/**
 * Starts the backend API, ready to listen for requests.
 * This will run the pre-run checks, then start Koa to listen on the configured port.
 * The backend API does not mandate a specific route for incoming data.
 */
export function startAPI (client: ProjectsClient): void {
  preRunChecks()

  const { port, authToken } = client.config.apiSettings()

  const koa = new Koa()

  koa.use(async ctx => {
    // Reject requests if the sender is not authenticated
    if (!isAuthenticated(ctx, authToken)) {
      return ctx.throw(403, error('Authentication failed'))
    }

    // Read the body from the request
    const bodyRes = await readBody(ctx.req)

    if (bodyRes.err) {
      log.error('Failed to read body from request')
      log.error(bodyRes.val)
      return ctx.throw(500, error('An internal error occurred'))
    }

    const body = bodyRes.val

    if (body.length === 0) {
      return ctx.throw(400, error('No request body provided'))
    }

    // Attempt to parse the body as JSON

    const jsonRes = Result.wrap(() => JSON.parse(body))

    if (jsonRes.err) {
      return ctx.throw(400, error('JSON parse error for request body'))
    }

    const json = jsonRes.val

    // Validate the structure of the JSON body
    const { error: jsonError, value } = incomingSubmissionValidator.validate(json)

    if (jsonError) {
      return ctx.throw(400, error(`JSON body was not a valid project submission: ${jsonError.message}`))
    }

    // Pass the JSON to the handler, handling any errors that arise
    const handleRes = await handleIncomingSubmission(value, client)

    if (handleRes.err) {
      log.error('API encountered internal error')
      log.error(handleRes.val)
      ctx.throw(500, error('An internal error occurred'))
    } else {
      ctx.status = 204
    }
  })

  koa.listen(port, '0.0.0.0', () => {
    log.info(`API listening on ${port}`)
  })
}
