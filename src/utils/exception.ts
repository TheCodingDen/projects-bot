import { internalLog } from '../communication/internal'

export function setup () {
  process.setUncaughtExceptionCaptureCallback(err => {
    internalLog.error(`Encountered uncaught exception: ${err.message} \n ${err.stack}`, undefined)
    logger.error(err)
  })
}
