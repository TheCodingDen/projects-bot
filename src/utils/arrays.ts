type Cross<T extends readonly unknown[], U extends readonly unknown[]> = Flatten<{
  [K in keyof T]: {
    [J in keyof U]: [T[K], U[J]]
  }
}>

type Flatten<T extends readonly unknown[], Acc extends readonly unknown[] = readonly []> =
  T extends readonly [infer H, ...infer R] ?
    H extends readonly unknown[] ?
      Flatten<R, readonly [...Acc, ...H]> :
      Flatten<R, readonly [...Acc, H]> :
    Acc

export function crossProduct<T extends readonly unknown[], U extends readonly unknown[]> (a: readonly [...T], z: readonly [...U]): Cross<T, U> {
  return a.flatMap(aa => z.map(zz => [aa, zz])) as unknown as Cross<T, U>
}

/**
 * Removes an element, based on the selector, from `ts`.
 *
 * This removal mutates the original array.
 *
 * If an element could not be found, this does nothing.
 */
export function remove<T> (ts: T[], selector: (item: T) => boolean): T[] {
  const idx = ts.findIndex(selector)

  if (idx === -1) {
    return ts
  }

  ts.splice(idx, 1)
  return ts
}
