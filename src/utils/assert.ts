export function assert (assertion: boolean, errorMessage: string): asserts assertion {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  if (!assertion) {
    throw new Error(`Assertion failed. (${errorMessage})`)
  }
}
