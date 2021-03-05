import { assertEquals } from 'https://deno.land/std@0.152.0/testing/asserts.ts'

import { group, test } from '../../test-hooks/mod.ts'
import { CustomError as ClassMain } from '../mod.ts'

group(ClassMain.name, () => {
  group('success', () => {
    test({
      name: 'no errors',
      fn() {
        class TestError extends ClassMain {
          constructor(message: string) {
            super(message)
          }
        }

        const results = new TestError('nope')

        assertEquals(results.message, 'nope')
        assertEquals(results instanceof ClassMain, true)
        assertEquals(results instanceof Error, true)
      },
    })
  })
})
