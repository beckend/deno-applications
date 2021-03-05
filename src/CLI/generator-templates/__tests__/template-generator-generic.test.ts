import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.152.0/testing/asserts.ts'

import { group, test } from '../../../modules/test-hooks/mod.ts'
import { TemplateGeneratorGeneric as ClassMain } from '../template-generator-generic.ts'

group(ClassMain.name, () => {
  group('static', () => {
    group('checks', () => {
      group('generateTemplate', () => {
        test({
          name: 'success toggle options contentFile and pathFile',
          fn() {
            assertEquals(
              ClassMain.checks.generateTemplate({
                pathFile: 'sdsa',
              }),
              {
                contentFile: undefined,
                exists: {
                  contentFile: false,
                  pathFile: true,
                },
                pathFile: 'sdsa',
              }
            )

            assertEquals(
              ClassMain.checks.generateTemplate({
                contentFile: 'sdsa',
              }),
              {
                contentFile: 'sdsa',
                exists: {
                  contentFile: true,
                  pathFile: false,
                },
                pathFile: undefined,
              }
            )
          },
        })

        test({
          name: 'errors',
          fn() {
            assertThrows(
              () => {
                ClassMain.checks.generateTemplate({})
              },
              Error,

              'specify either one of required contentFile or pathFile'
            )
          },
        })
      })
    })
  })
})
