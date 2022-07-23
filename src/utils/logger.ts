import pino from 'pino'

export const log: pino.Logger = pino({
  level: process.env.NODE_ENV !== 'development' ? 'info' : 'debug'
})
