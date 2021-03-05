// deno-lint-ignore-file no-explicit-any

import { assertEquals } from 'https://deno.land/std@0.114.0/testing/asserts.ts'

import { createClasses } from './create-classes.ts'
import { createCloneClass as fnMain, debug } from '../create-clone-class.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(fnMain.name, () => {
  group('success', () => {
    test({
      name: 'does not throw',
      fn() {
        const { A, B, C, D } = createClasses()

        fnMain(A)
        fnMain(B)
        fnMain(C)
        fnMain(D)
      },
    })

    test({
      name: 'clone parent methods',
      fn() {
        const { C } = createClasses()

        const CloneC = fnMain(C)
        const c = new CloneC('C')
        ;(Reflect as any).getPrototypeOf(C.prototype).method = () => 'not C'

        assertEquals(c.method(), 'C')
      },
    })

    test({
      name: 'clone own methods',
      fn() {
        const { D } = createClasses()

        const CloneD = fnMain(D)
        D.prototype.method = () => 'not D'

        const d = new CloneD()

        assertEquals(d.method(), 'D')
      },
    })

    test({
      name: 'create clone multiple times for same ClassConstructor',
      fn() {
        const { B } = createClasses()

        const CloneB = fnMain(B)
        const CloneB2 = fnMain(B)

        B.prototype.method = () => 'not B'

        const b = new CloneB('A')
        const b2 = new CloneB2('A')

        assertEquals(b.superMethod(), 'A')
        assertEquals(b.method(' G'), 'B A G')
        assertEquals(b2.method(), 'B A')
      },
    })

    test({
      name: 'resolve right instanceof for cloned class',
      fn() {
        const { A, B } = createClasses()

        const CloneB = fnMain(B)

        B.prototype.method = () => 'not B'

        const b = new CloneB('A')
        const bb = new B('A')

        assertEquals(b instanceof B, true)
        assertEquals(b instanceof A, true)
        assertEquals(bb instanceof CloneB, true)
        assertEquals(bb instanceof B, true)
        assertEquals(bb instanceof A, true)
      },
    })

    test({
      name: 'statics/getters/setters',
      fn() {
        const { A } = createClasses()
        const CloneA = fnMain(A)

        let testSetter = 1
        Reflect.defineProperty(CloneA, 'staticSetter', {
          get() {
            return testSetter
          },
          set(value: any) {
            testSetter = value
          },
        })

        Reflect.defineProperty(CloneA, 'staticMethod', {
          enumerable: true,
          configurable: true,
          writable: true,
          value: () => 'ok',
        })

        assertEquals(CloneA.staticMethod(), 'ok')
        assertEquals(CloneA.staticSetter, 1)
        CloneA.staticSetter = 44
        assertEquals(CloneA.staticSetter, 44)

        assertEquals(A.staticMethod(), 'static method')
        assertEquals(A.staticSetter, undefined)
        A.staticSetter = 2
        assertEquals(A.staticSetter, 2)
      },
    })

    test({
      name: 'map',
      fn() {
        const { C } = createClasses()
        const CloneC = fnMain(C)

        const instanceC = new C('C')
        const instanceCClone = new CloneC('C')

        instanceC.map.set('one', 1)
        assertEquals(instanceC.method2() instanceof Map, true)
        assertEquals(instanceC.map.get('one'), 1)
        assertEquals(C.mapStatic !== CloneC.mapStatic, true)

        assertEquals(instanceCClone.method2() instanceof Map, true)
        assertEquals(instanceCClone.map.get('one'), undefined)
      },
    })

    test({
      name: 'debug to cover code',
      fn() {
        const { A } = createClasses()
        const CloneC = fnMain(A)

        debug(CloneC)
      },
    })
  })
})
