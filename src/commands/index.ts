import { Command } from '../managers/commands'
import cleanup from './cleanup'
import create from './create'
import draft from './draft'
import edit from './edit'
import help from './help'
import reject from './reject'

export const commands: readonly Command[] = [
  edit,
  reject,
  create,
  help,
  draft,
  cleanup
] as const