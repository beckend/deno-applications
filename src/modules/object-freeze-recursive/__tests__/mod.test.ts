import { assertThrows } from 'https://deno.land/std@0.152.0/testing/asserts.ts'

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

        assertThrows(() => {
          ClassMain.deepFreeze(ClassInputTest).utils.prop1 = '2',
            Error,
            "Cannot assign to read only property 'prop1' of object '#<Object>'"
        })
      },
    })
  })
})
