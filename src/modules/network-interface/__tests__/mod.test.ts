import {
  assertEquals,
  assertThrowsAsync,
} from 'https://deno.land/std@0.114.0/testing/asserts.ts'

import { NetworkInterface as ClassMain } from '../mod.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(ClassMain.name, () => {
  group('static', () => {
    group('getSingleNetworkInterfacesData', () => {
      group('success', () => {
        test({
          name: 'works',
          async fn() {
            const result = await ClassMain.API.getSingleNetworkInterfacesData({
              checkRequiredCommands: true,
              nameInterface: 'lo',
            })

            assertEquals(result.nameInterface, 'lo')
            assertEquals(result.output.length > 0, true)
          },
        })
      })

      group('failure', () => {
        test({
          name: 'option shouldCheckRequiredCommands',
          async fn() {
            await assertThrowsAsync(
              () =>
                ClassMain.API.getSingleNetworkInterfacesData({
                  checkRequiredCommands: true,
                  nameInterface: 'loop23123',
                }),
              undefined,
              undefined,

              'Failed to get network interface data for interface: "loop23123"'
            )
          },
        })
      })
    })

    group('getNetworkInterfacesData', () => {
      group('success', () => {
        test({
          name: 'no options',
          async fn() {
            const result = await ClassMain.API.getNetworkInterfacesData()
            assertEquals(result.dataArray.length > 0, true)
            assertEquals(Object.keys(result.dataObject).length > 0, true)
            assertEquals(Boolean(result.dataObject['lo']), true)
          },
        })

        test({
          name: 'option exclusion',
          async fn() {
            const result = await ClassMain.API.getNetworkInterfacesData({
              interfacesExclude: ['lo'],
            })
            assertEquals(result.dataArray.length > 0, true)
            assertEquals(Object.keys(result.dataObject).length > 0, true)
            assertEquals(Boolean(result.dataObject['lo']), false)
          },
        })

        test({
          name: 'option inclusion',
          async fn() {
            const result = await ClassMain.API.getNetworkInterfacesData({
              interfacesInclude: ['lo'],
            })
            assertEquals(result.dataArray.length === 1, true)
            assertEquals(Object.keys(result.dataObject).length === 1, true)
            assertEquals(Boolean(result.dataObject['lo']), true)
          },
        })
      })

      group('failure', () => {
        test({
          name: 'invalid interface',
          async fn() {
            await assertThrowsAsync(
              () =>
                ClassMain.API.getNetworkInterfacesData({
                  interfacesInclude: ['lo234213'],
                }),
              undefined,
              undefined,
              'interface "lo234213" which is supposed to be included was not found in system.'
            )
          },
        })

        test({
          name: 'option shellCommandGetInterfaces',
          async fn() {
            await assertThrowsAsync(
              () =>
                ClassMain.API.getNetworkInterfacesData({
                  interfacesInclude: ['lo'],
                  shellCommandGetInterfaces: 'false',
                }),
              undefined,
              undefined,

              'Failed to get network interfaces using ===> /bin/bash --login -c false'
            )
          },
        })
      })
    })
  })
})
