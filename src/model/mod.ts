// deno-lint-ignore-file no-explicit-any

export type TAsyncReturnType<
  T extends (...args: any) => Promise<any>
> = T extends (...args: any) => Promise<infer R> ? R : any

export type TGenericObject<
  Key = string | number | boolean | undefined | symbol,
  Value = any
> = Record<Key extends string | number | symbol ? Key : never, Value>

export interface IGenericClass<T1 extends new (...args: any) => any = any> {
  new (...args: ConstructorParameters<T1>): T1
}

export type TUnArray<T> = T extends Array<infer U> ? U : T

export type TTruthy<T> = T extends false | '' | 0 | null | undefined ? never : T

export type TOptionalPromise<T1> = T1 | Promise<T1>
