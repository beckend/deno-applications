import { assertEquals } from 'https://deno.land/std@0.114.0/testing/asserts.ts'

import { group, test } from '../../test-hooks/mod.ts'

import { ClassArray as ClassMain } from '../mod.ts'

group(ClassMain.name, () => {
  group('static', () => {
    group('arrayToLookUpMap', () => {
      test({
        name: 'works',
        fn() {
          assertEquals(
            ClassMain.arrayToLookUpMap({ array: [2, '3', 'hello'] }),
            {
              2: true,
              3: true,
              hello: true,
            }
          )
        },
      })
    })

    group('chains', () => {
      test({
        name: 'passthrough',
        fn() {
          const mocks = {
            array: ['hello', 3213, '', 0, undefined, false, true, {}],
          }

          assertEquals(
            mocks.array.map(ClassMain.chains.passthrough),
            mocks.array
          )
        },
      })

      test({
        name: 'truthy',
        fn() {
          assertEquals(
            ['hello', 3213, '', 0, undefined, false, true, {}].filter(
              ClassMain.chains.truthy
            ),
            ['hello', 3213, true, {}]
          )
        },
      })
    })
  })
})
