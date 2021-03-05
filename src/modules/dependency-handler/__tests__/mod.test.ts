import { assertEquals } from 'https://deno.land/std@0.114.0/testing/asserts.ts'

import { group, test } from '../../test-hooks/mod.ts'
import { DependencyHandler as ClassMain } from '../mod.ts'

group(ClassMain.name, () => {
  group('option dependencies', () => {
    group('success', () => {
      test({
        name: 'getters/setter/restore of dependencies',
        fn() {
          const options = {
            dependencies: {
              method1: () => 2,
              prop1: [1, 2, 3],
            },
          }

          const instance = new ClassMain(options)

          assertEquals(instance.dependencies, options.dependencies)

          instance.dependenciesSet({
            prop1: [],
          })

          assertEquals(instance.dependencies.prop1, [])
          assertEquals(
            instance.dependencies.method1,
            options.dependencies.method1
          )

          instance.dependenciesRestore()

          assertEquals(instance.dependencies.prop1, options.dependencies.prop1)
        },
      })
    })
  })
})
