import { assertEquals } from 'https://deno.land/std@0.114.0/testing/asserts.ts'

// might expand module so not renaming to fnMain
import { bindAllFunctionsToObject } from '../mod.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(bindAllFunctionsToObject.name, () => {
  test({
    name: 'works',
    fn() {
      const { target } = bindAllFunctionsToObject({
        target: {
          nest: {
            val: 1,
            myFn() {
              return this.val
            },
          },

          get myVal() {
            return this.nest.val
          },
          getMyval() {
            return this.nest.val
          },
        },
      })

      const newFn1 = target.nest.myFn
      assertEquals(newFn1(), target.nest.val)

      assertEquals(target.myVal, target.nest.val)
      const newFn2 = target.getMyval
      assertEquals(newFn2(), target.nest.val)
    },
  })
})
