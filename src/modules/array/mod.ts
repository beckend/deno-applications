// deno-lint-ignore-file no-explicit-any
import { TTruthy } from '../../model/mod.ts'

export class ClassArray {
  static arrayToLookUpMap<
    T1 extends {
      array: T1['array'] & Array<any>
    }
  >({ array }: T1) {
    return array.reduce(
      (acc, key) => {
        acc[key] = true
        return acc
      },
      {} as {
        readonly [key: string]: boolean
      }
    )
  }

  static chains = {
    passthrough<T1>(x: T1) {
      return x
    },

    truthy<T1>(value: T1): value is TTruthy<T1> {
      return !!value
    },
  }
}
