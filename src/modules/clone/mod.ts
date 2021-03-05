import { ld } from '../lodash/mod.ts'
import { IGenericClass, TGenericObject } from '../../model/mod.ts'
import { createCloneClass } from './create-clone-class.ts'

export type TClassOrObject<T1> = T1 extends IGenericClass
  ? IGenericClass
  : T1 extends TGenericObject
  ? TGenericObject
  : T1

export function clone<T1 extends TGenericObject>(x: T1): T1
export function clone<T1 extends IGenericClass>(inputClone: T1) {
  if (inputClone.constructor.name === 'Function') {
    return createCloneClass(inputClone)
  }

  const clone = ld.cloneDeep(inputClone) as T1

  Object.entries(Object.getOwnPropertyDescriptors(inputClone)).forEach(
    ([keyProperty, descriptor]) => {
      if (descriptor) {
        if (descriptor.get || descriptor.set) {
          // lodash.cloneDeep does not handle getter or setters correctly
          Reflect.defineProperty(clone, keyProperty, ld.cloneDeep(descriptor))
        }
      }
    }
  )

  Reflect.setPrototypeOf(clone, Reflect.getPrototypeOf(inputClone))

  return clone
}
