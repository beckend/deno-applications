import { assertEquals } from 'https://deno.land/std@0.152.0/testing/asserts.ts'

import { clone as fnMain } from '../mod.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(fnMain.name, () => {
  group('success', () => {
    test({
      name: 'object',
      fn() {
        const sym1 = Symbol('x')

        const objectTest = {
          set lonk(num: number) {
            this.propNumber = num
          },

          get link(): number {
            return this.propNumber
          },

          propArray: [1, 2],
          propNumber: 3,

          [sym1]: 4,
        }

        const results = fnMain(objectTest)

        assertEquals(results.link, 3)
        results.lonk = 25
        assertEquals(objectTest.propNumber, 3)
        assertEquals(results.propNumber, 25)

        results.propArray[0] = 2
        assertEquals(objectTest.propArray[0], 1)
        assertEquals(results.propArray[0], 2)

        assertEquals(Reflect.ownKeys(results), [
          'lonk',
          'link',
          'propArray',
          'propNumber',
          sym1,
        ])
      },
    })

    test({
      name: 'class',
      fn() {
        const sym1 = Symbol('x')

        class ClassTest {
          set lonk(num: number) {
            this.propNumber = num
          }

          get link(): number {
            return this.propNumber
          }

          propArray = [1, 2]
          propNumber = 3;
          [sym1] = 4
        }

        const ClassNew = fnMain(ClassTest)
        const results = new ClassNew()
        const resultsClassOld = new ClassTest()

        assertEquals(results.link, 3)
        results.lonk = 25
        assertEquals(resultsClassOld.propNumber, 3)
        assertEquals(results.propNumber, 25)

        results.propArray[0] = 2
        assertEquals(resultsClassOld.propArray[0], 1)
        assertEquals(results.propArray[0], 2)

        assertEquals(Reflect.ownKeys(ClassNew), [
          'length',
          'name',
          'prototype',
          Symbol.hasInstance,
        ])
      },
    })
  })
})
