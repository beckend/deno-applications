// deno-lint-ignore-file no-explicit-any no-extra-semi

import { TGenericObject } from '../../model/mod.ts'

const mapBindNamesBlacklist = {
  constructor: true,
}

export const bindAllFunctionsToObject = <
  T1 extends {
    readonly target: T1['target'] extends TGenericObject ? T1['target'] : any
  }
>({
  target,
}: T1) => {
  for (const property in target) {
    if (property[0] !== '_' && !(mapBindNamesBlacklist as any)[property]) {
      const value = target[property]

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        bindAllFunctionsToObject({
          target: value as TGenericObject,
        })
      } else if (
        typeof value === 'function' &&
        !value.name.startsWith('bound')
      ) {
        ;(target as any)[property] = value.bind(target)
      }
    }
  }

  return { target }
}
