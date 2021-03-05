// deno-lint-ignore-file no-explicit-any

import { ld } from '../lodash/mod.ts'
import { IGenericClass, TGenericObject } from '../../model/mod.ts'

/**
 * https://github.com/mjancarik/create-clone-class
 */

export type TGenericClass = IGenericClass | TGenericObject

export function createCloneClass<T1 extends TGenericClass>(
  ClassConstructor: T1
) {
  const CloneClassConstructor = createEmptyClass(ClassConstructor)

  // create empty prototype chain from defined class
  const {
    CloneClassConstructor: LastCloneClassConstructor,
  } = addEmptyPrototypeChain(ClassConstructor, CloneClassConstructor)

  // added real prototype chain at the end of prototype due to instanceof
  addRealPrototypeChain(ClassConstructor, LastCloneClassConstructor)

  clonePrototypeChainMethods(ClassConstructor, CloneClassConstructor)
  copyStatics(ClassConstructor, CloneClassConstructor)

  return (CloneClassConstructor as any) as T1
}

export function debug<T1 extends TGenericClass>(ClassConstructor: T1) {
  const iterate = createIterator(ClassConstructor)

  return iterate(({ ClassConstructor, prototype }) => {
    console.log(`Class ${ClassConstructor.name}`)

    Object.entries(Object.getOwnPropertyDescriptors(prototype)).forEach(
      ([property]) => {
        console.log(`\tproperty ${property}`)
      }
    )
  })
}

function createEmptyClass<T1 extends TGenericClass>(ClassConstructor: T1) {
  class EmptyClass {
    static [Symbol.hasInstance](instance: EmptyClass) {
      return instance instanceof (ClassConstructor as IGenericClass)
    }

    constructor(...args: Array<any>) {
      return Reflect.construct(this.constructor, args, EmptyClass)
    }
  }

  Reflect.defineProperty(EmptyClass, 'name', { value: ClassConstructor.name })

  return EmptyClass
}

function createIterator<T1 extends TGenericClass>(ClassConstructor: T1) {
  const prototypeIterator = prototypeGenerator(ClassConstructor)
  const OriginalClassConstructor = ClassConstructor
  const OriginalPrototype = ClassConstructor.prototype

  const iterator = <
    T1Iterator extends (
      x: T2Iterator & {
        readonly prototype: any
        readonly ClassConstructor: T1
        readonly OriginalClassConstructor: T1
        readonly OriginalPrototype: IGenericClass
      }
    ) => ReturnType<T1Iterator>,
    T2Iterator
  >(
    action: T1Iterator,
    args?: T2Iterator
  ): T2Iterator & {
    readonly prototype: any
    readonly ClassConstructor: T1
    readonly OriginalClassConstructor: T1
    readonly OriginalPrototype: IGenericClass
  } => {
    let result = {}

    for (const iteration of prototypeIterator) {
      result = action({
        ...(args as any),
        ...{ OriginalClassConstructor, OriginalPrototype },
        ...iteration,
        ...result,
      })
    }

    return {
      ...(args as any),
      ...{ OriginalClassConstructor, OriginalPrototype },
      ...result,
    }
  }

  return iterator
}

function* prototypeGenerator<T1 extends TGenericClass>(ClassConstructor: T1) {
  let prototype = ClassConstructor.prototype

  while (
    prototype &&
    prototype !== Function.prototype &&
    prototype !== Object.prototype
  ) {
    yield { prototype, ClassConstructor }
    ;(ClassConstructor as any) = Reflect.getPrototypeOf(ClassConstructor)
    prototype = ClassConstructor.prototype
  }
}

function addEmptyPrototypeChain<
  T1 extends TGenericClass,
  T2 extends TGenericClass
>(ClassConstructor: T1, CloneClassConstructor: T2) {
  const NextClassConstructor = Reflect.getPrototypeOf(ClassConstructor)
  const OriginalCloneClassConstructor = CloneClassConstructor
  const iterate = createIterator(NextClassConstructor!)

  return iterate(
    ({ ClassConstructor, CloneClassConstructor }) => {
      const EmptyClass = createEmptyClass(ClassConstructor)
      Reflect.setPrototypeOf(CloneClassConstructor, EmptyClass)
      Reflect.setPrototypeOf(
        CloneClassConstructor.prototype,
        EmptyClass.prototype
      )
      ;(CloneClassConstructor as any) = Reflect.getPrototypeOf(
        CloneClassConstructor
      )

      return { CloneClassConstructor }
    },
    { CloneClassConstructor, OriginalCloneClassConstructor }
  )
}

function addRealPrototypeChain<
  T1 extends TGenericClass,
  T2 extends TGenericClass
>(ClassConstructor: T1, CloneClassConstructor: T2) {
  const OriginalCloneClassConstructor = CloneClassConstructor
  const iterate = createIterator(ClassConstructor)

  return iterate(
    ({ ClassConstructor, CloneClassConstructor }) => {
      Reflect.setPrototypeOf(CloneClassConstructor, ClassConstructor)
      Reflect.setPrototypeOf(
        CloneClassConstructor.prototype,
        ClassConstructor.prototype
      )
      ;(CloneClassConstructor as any) = Reflect.getPrototypeOf(
        CloneClassConstructor
      )

      return { CloneClassConstructor }
    },
    { CloneClassConstructor, OriginalCloneClassConstructor }
  )
}

function clonePrototypeChainMethods<
  T1 extends TGenericClass,
  T2 extends TGenericClass
>(ClassConstructor: T1, CloneClassConstructor: T2) {
  const OriginalCloneClassConstructor = CloneClassConstructor
  const iterate = createIterator(ClassConstructor)

  return iterate(
    ({ prototype, CloneClassConstructor }) => {
      Object.entries(Object.getOwnPropertyDescriptors(prototype)).forEach(
        ([property, descriptor]) => {
          Reflect.defineProperty(
            CloneClassConstructor.prototype,
            property,
            ld.cloneDeep(descriptor)
          )
        }
      )
      ;(CloneClassConstructor as any) = Reflect.getPrototypeOf(
        CloneClassConstructor
      )

      return { CloneClassConstructor }
    },
    { CloneClassConstructor, OriginalCloneClassConstructor }
  )
}

function copyStatics<T1 extends TGenericClass, T2 extends TGenericClass>(
  ClassConstructor: T1,
  CloneClassConstructor: T2
) {
  const OriginalCloneClassConstructor = CloneClassConstructor
  const iterate = createIterator(ClassConstructor)

  return iterate(
    ({ CloneClassConstructor }) => {
      Object.entries(
        Object.getOwnPropertyDescriptors(ClassConstructor)
      ).forEach(([property, descriptor]) => {
        Reflect.defineProperty(
          CloneClassConstructor,
          property,
          ld.cloneDeep(descriptor)
        )
      })

      return { CloneClassConstructor }
    },
    { CloneClassConstructor, OriginalCloneClassConstructor }
  )
}
