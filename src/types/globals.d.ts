/* eslint-disable no-var */
import pino from 'pino'

declare global {
  var logger: pino.Logger<pino.LoggerOptions>
}
