import path from 'path'
import fs from 'fs-extra'

export default (): void => {
  const logPath = path.resolve(__dirname, '../../logs')
  const dbPath = path.resolve(__dirname, '../../data')

  try {
    fs.ensureDirSync(logPath)
    fs.ensureDirSync(dbPath)
  } catch (err) {
    log.error(`Ensuring of required log and data directories failed: ${err}`)
    log.error('Exiting...')
    process.exit(1)
  }
}
