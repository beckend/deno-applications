// deno-lint-ignore-file no-explicit-any
import {
  assertEquals,
  assertArrayIncludes,
} from 'https://deno.land/std@0.152.0/testing/asserts.ts'

import { TestUtilities } from '../../../modules/test-utilities/mod.ts'
import { NetworkIPs as ClassMain } from '../mod.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(ClassMain.name, () => {
  group('static', () => {
    group('getNetInterfaceIPs', () => {
      test({
        name: 'works',
        async fn() {
          assertEquals(
            (await ClassMain.getNetInterfaceIPs({ nameInterface: 'lo' }))
              .success,
            true
          )
        },
      })
    })

    group('getNetInterfacesIPs', () => {
      group('success', () => {
        test({
          name: 'works',
          async fn() {
            const results = await ClassMain.getNetInterfacesIPs({
              nameInterfaces: ['lo'],
            })
            assertEquals(results.dataArray.length > 0, true)
            assertEquals(Object.keys(results.dataObject).length > 0, true)
          },
        })

        test
      })

      group('failure', () => {
        test({
          name: 'by option getDataIP',
          async fn() {
            ClassMain.DH.dependenciesSet({
              Exec: {
                API: {
                  async exec({ getCommand }: any) {
                    const returned = await getCommand()
                    assertArrayIncludes(returned, 'ip addr show')
                    await TestUtilities.utils.delay(0)
                    return {
                      outputs: {
                        stdOut: '',
                      },
                    }
                  },
                },
              } as any,
            })

            const results = await ClassMain.getNetInterfaceIPs({
              nameInterface: 'lo',
            })

            assertEquals(results, {
              dataArray: {
                IPvAll: [],
                IPv4: [],
                IPv6: [],
              },
              hasIPs: false,
              nameInterface: 'lo',
              success: false,
            })
          },
        })
      })
    })
  })
})
