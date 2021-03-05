// deno-lint-ignore-file no-explicit-any no-prototype-builtins

export class ObjectFreezeRecursive {
  static deepFreeze<T1>(o: T1) {
    for (const [key, value] of Object.entries(o)) {
      if ((o as any).hasOwnProperty(key) && typeof value == 'object') {
        ObjectFreezeRecursive.deepFreeze(value)
      }
    }

    return Object.freeze(o)
  }
}
