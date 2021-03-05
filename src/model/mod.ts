// deno-lint-ignore-file no-explicit-any

export type TGenericFunction = (...x: any) => any

export type TAsyncReturnType<T extends TGenericFunction> = T extends (
  ...args: any
) => PromiseLike<infer R>
  ? R
  : ReturnType<T>

export type TGenericObject<
  Key = string | number | boolean | undefined | symbol,
  Value = any
> = Record<Key extends string | number | symbol ? Key : never, Value>

export interface IGenericClass<T1 extends new (...args: any) => any = any> {
  new (...args: ConstructorParameters<T1>): T1
}

export type TUnArray<T> = T extends Array<infer U> ? U : T

export type TTruthy<T> = T extends false | '' | 0 | null | undefined ? never : T

export type TOptionalPromise<T1> = T1 | PromiseLike<T1>
export type TWriteable<T> = { -readonly [P in keyof T]: T[P] }

export type TUnpackedArrayItem<T> = T extends (infer U)[] ? U : T

export type TRecursivePartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer I>
    ? Array<TRecursivePartial<I>>
    : TRecursivePartial<T[P]>
}
