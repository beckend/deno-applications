export class DataTypes {
  static Uint8Array = {
    // will not handle all languages, but ASCII works fine
    fromString: <T1 extends string>(x: T1) => {
      const arr: Array<number> = []

      for (let i = 0; i < x.length; i++) {
        arr.push(x[i].charCodeAt(0))
      }

      return Uint8Array.from(arr)
    },
  }
}
