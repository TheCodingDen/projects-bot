import pino from 'pino'

export const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'silent',
  formatters: {
    level: (label) => ({ level: label })
  }
}

if (process.env.NODE_ENV !== 'production') {
  loggerOptions.transport = {
    target: 'pino-pretty'
  }
}

export default pino(loggerOptions)
