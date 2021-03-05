// deno-lint-ignore-file no-explicit-any

import {
  assertEquals,
  assertThrowsAsync,
} from 'https://deno.land/std@0.114.0/testing/asserts.ts'
import { generate as generateUUIDV4 } from 'https://deno.land/std@0.114.0/uuid/v4.ts'
import { exists as fsExists } from 'https://deno.land/std@0.114.0/fs/mod.ts'

import { TestUtilities as ClassMain } from '../mod.ts'
import { FixtureClass, fixtureObject } from './fixtures/getcomponent.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(ClassMain.name, () => {
  const instances = {
    textEncoder: new TextEncoder(),
  }

  group('static', () => {
    group('getters', () => {
      group('deferredPromise', () => {
        test({
          name: 'reject/resolve',
          async fn() {
            await ClassMain.getters.deferredPromise({
              afterDelay() {
                return 0
              },
              timeout: 0,
            })

            await assertThrowsAsync(
              () =>
                ClassMain.getters.deferredPromise({
                  afterDelay() {
                    throw new Error('throw')
                  },
                  timeout: 0,
                }),
              undefined,
              undefined,
              'throw'
            )
          },
        })
      })
    })

    group('utils', () => {
      group('executeAndIgnoreErrors', () => {
        test({
          name: 'works',
          async fn() {
            await ClassMain.utils.executeAndIgnoreErrors({
              fns: [
                () => {
                  throw new Error('haha')
                },
                () => 'ok',
              ],
            })
          },
        })
      })

      group('extendObjectProperties', () => {
        test({
          name: 'works for objects',
          fn() {
            const options = {
              objectExtended: {
                addMe: 1,
                exist1: 'exist-altered',
                nest1: {
                  addNest1: 'added',
                },
                get getter1() {
                  return 1
                },
                set getter1(x: number) {
                  this.addMe = x
                },
              },

              objectSource: {
                exist1: 'exists',
                nest1: {
                  nestProp1: 'prop1',
                },
              },

              mergeWithKeys: {
                nest1: true,
              },

              targetToExtend: {},
            }

            const results = ClassMain.utils.extendObjectProperties(options)

            const resultsDesc = Reflect.getOwnPropertyDescriptor(
              results.targetToExtend,
              'getter1'
            )
            assertEquals(typeof resultsDesc?.set, 'function')
            assertEquals(typeof resultsDesc?.get, 'function')
            assertEquals(results.targetToExtend.getter1, 1)
            results.targetToExtend.getter1 = 44
            assertEquals(results.targetToExtend.addMe, 44)

            delete results.targetToExtend.getter1

            assertEquals(results, {
              ...options,
              targetToExtend: {
                addMe: 44,
                exist1: 'exist-altered',
                nest1: {
                  addNest1: 'added',
                  nestProp1: 'prop1',
                },
              },
            })
          },
        })

        test({
          name: 'works for classes',
          fn() {
            const options = {
              objectExtended: {
                addMe: 1,
                exist1: 'exist-altered',
                nest1: {
                  addNest1: 'added',
                },
              },

              objectSource: {
                exist1: 'exists',
                nest1: {
                  nestProp1: 'prop1',
                },
              },

              mergeWithKeys: {
                nest1: true,
              },

              targetToExtend: class TheClass {},
            }

            const results: any = ClassMain.utils.extendObjectProperties(options)
            assertEquals(results.targetToExtend.addMe, 1)
            assertEquals(results.targetToExtend.exist1, 'exist-altered')
            assertEquals(results.targetToExtend.nest1.nestProp1, 'prop1')
          },
        })
      })

      group('generateTempFilePath', () => {
        test({
          name: 'works',
          fn() {
            assertEquals(ClassMain.utils.generateTempFilePath().length, 35)

            assertEquals(
              ClassMain.utils.generateTempFilePath({
                optionsGenerateUUIDV5: {
                  data: instances.textEncoder.encode('test'),
                  namespace: generateUUIDV4(),
                },
              }).length,
              35
            )
          },
        })
      })

      group('runDeno', () => {
        test({
          name: 'works',
          async fn() {
            await ClassMain.utils.runDeno({
              argsCLI: ['--help'],

              onOutputs(x) {
                assertEquals(x.output instanceof Uint8Array, true)
                assertEquals(x.outputError instanceof Uint8Array, true)
                assertEquals(typeof x.outputResults === 'string', true)
                assertEquals(typeof x.outputResultsError === 'string', true)
              },
            })
          },
        })
      })

      group('executeAndClean', () => {
        test({
          name: 'works and cleanups files when it is done',
          async fn() {
            let pathFileInput = ''

            await ClassMain.utils.executeAndClean(
              async ({ fileHandler, generateTempFilePath }) => {
                pathFileInput = generateTempFilePath()

                const { pathFile } = await fileHandler.API.writeFile({
                  contentFile: 'export const myVariable = [1,2,3]',
                  createDirectory: false,
                  pathFile: pathFileInput,
                })

                assertEquals(await fsExists(pathFileInput), true)

                assertEquals(
                  (await fileHandler.loadersModule.ts({ pathFile })).myVariable,
                  [1, 2, 3]
                )
              }
            )

            assertEquals(
              typeof pathFileInput === 'string' && pathFileInput.length > 0,
              true
            )

            assertEquals(await fsExists(pathFileInput), false)
          },
        })
      })
    })
  })

  group('instance', () => {
    group('getters', () => {
      group('component/instance', () => {
        test({
          name: 'class mixed test',
          async fn() {
            const tf = new ClassMain({
              getComponent: () => FixtureClass,
            })

            const results = await tf.getters.component({
              staticMocks: {
                addedProp1: 2,
                deepNest: {
                  addedDeepNest1: true,
                },
                staticValue: [],
              },
              staticMergeWithKeys: {
                deepNest: true,
              },
              withComponentPayload() {
                return 2323
              },
            })

            assertEquals(results.withComponentPayloadResults, 2323)
            assertEquals(results.newModule.addedProp1, 2)
            assertEquals(results.newModule.staticValue.length, 0)
            assertEquals(results.NewModule.staticValue.length, 0)
            assertEquals(results.newModule.deepNest.addedDeepNest1, true)
            assertEquals(results.newModule.deepNest, {
              addedDeepNest1: true,
              level1: { level2: { level3: 3 } },
            })
            const { instance, withInstancePayloadResults } =
              await tf.getters.instance({
                withInstancePayload() {
                  return 7777777777777777777
                },
              })

            assertEquals(withInstancePayloadResults, 7777777777777777777)
            assertEquals(instance.instanceValue1, 5)
            assertEquals(instance.instanceMethod1(), 5)
          },
        })

        test({
          name: 'object mixed test',
          async fn() {
            const tf = new ClassMain({
              getComponent: () => fixtureObject,
            })

            const results = await tf.getters.component({
              staticMocks: {
                get objectGetter1() {
                  return this.addedProp1
                },

                addedProp1: 2,
                objectArray: [5, 5, 5, 5],
              },
              staticMergeWithKeys: {
                objectArray: true,
              },
            })

            assertEquals(results.newModule.addedProp1, 2)
            assertEquals(results.newModule.objectArray, [1, 2, 3, 5])
            assertEquals(results.newModule.addedProp1, 2)
            assertEquals(results.newModule.objectGetter1, 2)
            results.newModule.objectSetter1 = 3
            assertEquals(results.newModule.instanceValue1, 3)
          },
        })
      })
    })
  })
})
