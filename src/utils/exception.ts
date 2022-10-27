import { internalLog } from '../communication/internal'

export function setup (): void {
  process.setUncaughtExceptionCaptureCallback(err => {
    internalLog.error(`Encountered uncaught exception: ${err.message} \n ${err.stack}`, undefined)
    logger.error(err)
  })
}
