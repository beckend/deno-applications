import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.99.0/testing/asserts.ts'

import { ObjectFreezeRecursive as ClassMain } from '../mod.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(ClassMain.name, () => {
  group('static', () => {
    test({
      name: 'deepFreeze',
      fn() {
        class ClassInputTest {
          static utils = {
            prop1: '1',
          }
        }

        const result = assertThrows(() => {
          ClassMain.deepFreeze(ClassInputTest).utils.prop1 = '2'
        })

        assertEquals(
          result.message,
          "Cannot assign to read only property 'prop1' of object '#<Object>'"
        )
      },
    })
  })
})
