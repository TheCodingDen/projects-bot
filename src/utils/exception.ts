import { internalLog } from '../communication/internal'

/**
 * Register an uncaught exception handler with the current process.
 * This will log uncaught errors to the internal log.
 */
export function setup (): void {
  process.setUncaughtExceptionCaptureCallback(err => {
    logger.error(err)
    internalLog.error({
      type: 'text',
      content: `Encountered uncaught exception: ${err.message} \n ${err.stack}`,
      ctx: undefined
    })
  })
}
