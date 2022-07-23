export default {
  '*.(ts|js)': 'eslint --cache --fix',

  // We turn the list of filenames into a series of commands since `prisma format` only allows
  // specifying formatting a single file.
  //
  // Eslint disabled since otherwise we have no types available in the js file.
  // eslint-disable-next-line tsdoc/syntax
  /** @param {string[]} filenames */
  '*.prisma': (filenames) => filenames.map((filename) => `prisma format --schema ${filename}`)
}
