// deno-lint-ignore-file no-explicit-any no-extra-semi
import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.152.0/testing/asserts.ts'
import { StringReader } from 'https://deno.land/std@0.152.0/io/mod.ts'
import { ensureDir as fsEnsureDir } from 'https://deno.land/std@0.152.0/fs/mod.ts'
import { dirname } from 'https://deno.land/std@0.152.0/path/mod.ts'
import {
  copy,
  readAll,
} from 'https://deno.land/std@0.152.0/streams/conversion.ts'

import { TGenericObject } from '../../../model/mod.ts'
import { group, test } from '../../test-hooks/mod.ts'
import { FileHandler as ClassMain, ErrorInvariantLoadModule } from '../mod.ts'
import { TestUtilities } from '../../test-utilities/mod.ts'

const tf = new TestUtilities({
  getComponent: () => ClassMain,
})

const contextTest = {
  payloadInstance: await tf.getters.instance(),
}

group(ClassMain.name, () => {
  group('static', () => {
    group('getters', () => {
      group('errorInvariantLoadModule', () => {
        test({
          name: 'returns correctly',
          fn() {
            assertEquals(
              ClassMain.getters.errorInvariantLoadModule({
                IDLoader: 'hello',
              }) instanceof ErrorInvariantLoadModule,
              true
            )
          },
        })
      })

      group('yaml', () => {
        group('toArrayOfObjects', () => {
          test({
            name: 'works',
            fn() {
              assertEquals(
                ClassMain.getters.yaml.toArrayOfObjects({
                  text: `
                    one: 1
                    ---
                    two: 2
                  `,
                }),
                [
                  {
                    one: 1,
                  },
                  {
                    two: 2,
                  },
                ]
              )
            },
          })
        })

        group('toYaml', () => {
          test({
            name: 'works',
            fn() {
              const mockData = {
                dataArray: ClassMain.getters.yaml.toArrayOfObjects({
                  text: `
                    one: 1
                    ---
                    two: 2
                  `,
                }),
              }

              const resultsString = ClassMain.getters.yaml.toYaml(mockData)

              assertEquals(
                ClassMain.getters.yaml.toYaml(mockData),
                'one: 1\n---\ntwo: 2\n'
              )

              assertEquals(
                ClassMain.getters.yaml.toArrayOfObjects({
                  text: resultsString,
                }),
                [
                  {
                    one: 1,
                  },
                  {
                    two: 2,
                  },
                ]
              )
            },
          })
        })
      })

      group('URL', () => {
        test({
          name: 'type github',
          fn() {
            assertEquals(
              ClassMain.getters.URL({
                URL: 'https://github.com/flannel-io/flannel/blob/master/Documentation/kube-flannel.yml',
              }),
              {
                URL: new URL(
                  'https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml'
                ),
              }
            )

            assertEquals(
              ClassMain.getters.URL({
                URL: 'https://gitHAB.com/flannel-io/flannel/blob/master/Documentation/kube-flannel.yml',
              }),
              {
                URL: new URL(
                  'https://gitHAB.com/flannel-io/flannel/blob/master/Documentation/kube-flannel.yml'
                ),
              }
            )
          },
        })
      })
    })

    group('utils', () => {
      group('sanitizePath', () => {
        test({
          name: 'replaces ~ with user home directory',
          fn() {
            assertEquals(
              ClassMain.utils.sanitizePath({
                path: '~/hello',
              }),
              Deno.env.get('HOME') + '/hello'
            )
          },
        })

        test({
          name: 'otherwise no effect',
          fn() {
            assertEquals(
              ClassMain.utils.sanitizePath({
                path: '/yes/no/hello',
              }),
              '/yes/no/hello'
            )
          },
        })
      })
    })
  })

  group('instance', () => {
    group('API', () => {
      group('createFileDirectory', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.API.createFileDirectory,
          }
        }

        group('option createDirectory', () => {
          test({
            name: 'true',
            async fn() {
              const { instance, targetFn } = await getTargetFn()

              const mockData = {
                createDirectory: true,
                path: '/tmp/path',
              }

              instance.DH.dependenciesSet({
                Deno: {
                  async lstat(path: string) {
                    assertEquals(typeof path === 'string', true)
                    await TestUtilities.utils.delay(0)
                    return false as any
                  },
                },

                fs: {
                  ensureDir: async function (dir) {
                    assertEquals(dir, dirname(mockData.path))
                    await TestUtilities.utils.delay(0)
                  } as typeof fsEnsureDir,
                },
              })

              assertEquals(await targetFn(mockData), undefined)
            },
          })

          test({
            name: 'false',
            async fn() {
              const { instance, targetFn } = await getTargetFn()

              const mockData = {
                createDirectory: false,
                path: '/tmp/path',
              }

              instance.DH.dependenciesSet({
                Deno: {
                  async lstat(path: string) {
                    assertEquals(typeof path === 'string', true)
                    await TestUtilities.utils.delay(0)
                    return false as any
                  },
                },

                fs: {
                  ensureDir: async function (dir) {
                    assertEquals(dir, dirname(mockData.path))
                    await TestUtilities.utils.delay(0)
                  } as typeof fsEnsureDir,
                },
              })

              await assertRejects(
                () => targetFn(mockData),

                Error,
                'directory "/tmp" does not exist and option to create it is not true.'
              )
            },
          })
        })
      })

      group('downloadFile', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.API.downloadFile,
          }
        }

        group('success', () => {
          test({
            name: 'option returnContent',
            async fn() {
              const { contentFile } = await (
                await getTargetFn()
              )
                .targetFn({
                  request:
                    'https://storage.googleapis.com/kubernetes-release/release/stable.txt',
                  returnContent: true,
                })
                .fetch()

              assertEquals(contentFile && contentFile.length > 1, true)
            },
          })

          test({
            name: 'option pathFile and toggle returnContent',
            async fn() {
              const { instance, targetFn } = await getTargetFn()

              const contentFile = 'contentFile'

              const mocksData = {
                pathFile: '/tmp/this/should/not/really/exist/1-2-3-4-5',
                contentFile,
                readerSource: new StringReader(contentFile),
              }

              Object.assign(instance.API, {
                createFileDirectory() {},
              })

              instance.DH.dependenciesSet({
                Deno: {
                  open: async function (pathFile) {
                    assertEquals(pathFile, mocksData.pathFile)
                    await TestUtilities.utils.delay(0)
                    return new (class FileFake {
                      close() {}
                    })()
                  } as typeof Deno.open,

                  readTextFile: async function (pathFile) {
                    assertEquals(pathFile, mocksData.pathFile)
                    await TestUtilities.utils.delay(0)
                    return contentFile
                  } as typeof Deno.readTextFile,
                },

                stream: {
                  copy: async function (reader, file) {
                    assertEquals(typeof reader.read, 'function')
                    assertEquals(typeof (file as any).close, 'function')
                    // prints file content to stdout to prevent resource leaking
                    await copy(reader, Deno.stdout)
                    return 0
                  } as typeof copy,
                },
              })

              const [results1, results2] = await Promise.all([
                targetFn({
                  request:
                    'https://storage.googleapis.com/kubernetes-release/release/stable.txt',
                  pathFile: mocksData.pathFile,
                }).fetch(),

                targetFn({
                  request:
                    'https://storage.googleapis.com/kubernetes-release/release/stable.txt',
                  pathFile: mocksData.pathFile,
                  returnContent: true,
                }).fetch(),
              ])

              assertEquals(results1.response instanceof Response, true)

              assertEquals(results1, {
                ...results1,
                contentFile: undefined,
              })
              assertEquals(results2, {
                ...results2,
                contentFile: mocksData.contentFile,
              })
            },
          })
        })

        group('failure', () => {
          test({
            name: 'missing arguments',
            fn: async () => {
              await assertRejects(
                async () => {
                  ;(await getTargetFn()).targetFn({
                    request: 'does not matter',
                  })
                },
                Error,

                'Either combinations of argument pathFile/transformPathFile/returnContent is required.'
              )
            },
          })
        })
      })

      group('readFileToString', () => {
        group('success', () => {
          test({
            name: 'read correctly',
            async fn() {
              const { instance } = await tf.getters.instance()

              const expected = {
                contentFile: 'hello',
                pathFile: '/tmp/does-not-matter',
              }

              instance.DH.dependenciesSet({
                Deno: {
                  readFile: ((pathFile) => {
                    assertEquals(pathFile, expected.pathFile)

                    return TestUtilities.getters.deferredPromise({
                      afterDelay: () =>
                        new TextEncoder().encode(expected.contentFile),
                    })
                  }) as typeof Deno.readFile,
                },
              })

              assertEquals(
                await instance.API.readFileToString({
                  pathFile: expected.pathFile,
                }),
                expected.contentFile
              )
            },
          })
        })
      })

      group('writeFile', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.API.writeFile,
          }
        }

        group('success', () => {
          test({
            name: 'option contentFile toggle option returnContent',
            async fn() {
              const { instance, targetFn } = await getTargetFn()

              const options = {
                contentFile: 'hello',
                pathFile: '/tmp/does-not-matter',
              }

              instance.DH.dependenciesSet({
                Deno: {
                  writeTextFile: async function (pathFile, contentFile) {
                    assertEquals(pathFile, options.pathFile)
                    assertEquals(contentFile, options.contentFile as any)
                    await TestUtilities.utils.delay(0)
                  } as typeof Deno.writeFile,
                } as any,
              })

              assertEquals(await targetFn(options), {
                appliedChmod: false,
                appliedChown: false,
                contentFile: undefined,
                pathFile: options.pathFile,
                readerSource: undefined,
                wroteFile: true,
              })

              assertEquals(
                await targetFn({
                  ...options,
                  returnContent: true,
                }),
                {
                  ...options,
                  readerSource: undefined,
                  appliedChmod: false,
                  appliedChown: false,
                  wroteFile: true,
                }
              )
            },
          })

          test({
            name: 'option toggle createDirectory and pathFile has directory tree when directory does not exist',
            async fn() {
              const { instance, targetFn } = await getTargetFn()
              const options = {
                pathFile: '/tmp/this/should/not/really/exist/1-2-3-4-5',
                contentFile: 'hello',
                createDirectory: true,
              }

              instance.DH.dependenciesSet({
                Deno: {
                  async lstat(path: string | URL) {
                    assertEquals(typeof path === 'string', true)
                    await TestUtilities.utils.delay(0)
                    return false as any
                  },
                  writeTextFile: async function (pathFile, contentFile) {
                    assertEquals(pathFile, options.pathFile)
                    assertEquals(contentFile, options.contentFile as any)
                    await TestUtilities.utils.delay(0)
                  } as typeof Deno.writeFile,
                },

                fs: {
                  ensureDir: async function (dir) {
                    assertEquals(dir, dirname(options.pathFile))
                    await TestUtilities.utils.delay(0)
                  } as typeof fsEnsureDir,
                },
              })

              assertEquals(await targetFn(options), {
                appliedChmod: false,
                appliedChown: false,
                contentFile: undefined,
                pathFile: options.pathFile,
                readerSource: undefined,
                wroteFile: true,
              })

              await assertRejects(
                () =>
                  targetFn({
                    contentFile: 'something',
                    createDirectory: false,
                    pathFile: '/tmp/1/2/3/4/5',
                  }),
                Error,

                'directory "/tmp/1/2/3/4" does not exist and option to create it is not true.'
              )
            },
          })

          test({
            name: 'option readerSource and toogle option returnContent and toggle contentFile',
            async fn() {
              const { instance, targetFn } = await getTargetFn()
              const contentFile = 'hello'
              const options = {
                pathFile: '/tmp/this/should/not/really/exist/1-2-3-4-5',
                readerSource: new StringReader(contentFile),
              }

              instance.DH.dependenciesSet({
                Deno: {
                  open: async function (pathFile) {
                    assertEquals(pathFile, options.pathFile)
                    await TestUtilities.utils.delay(0)
                    return new (class FileFake {
                      close() {}
                    })()
                  } as typeof Deno.open,

                  async lstat(path: string | URL) {
                    assertEquals(typeof path === 'string', true)
                    await TestUtilities.utils.delay(0)
                    return true as any
                  },

                  writeFile: async function (pathFile, contentBuffer) {
                    assertEquals(pathFile, options.pathFile)
                    assertEquals(contentBuffer instanceof Uint8Array, true)
                    await TestUtilities.utils.delay(0)
                  } as typeof Deno.writeFile,
                },

                Uint8Array: {
                  readAll: function (readerSource: Deno.Reader) {
                    assertEquals(readerSource, options.readerSource)
                    return readAll(readerSource)
                  } as typeof readAll,
                },

                stream: {
                  copy: async function (reader, file) {
                    assertEquals(reader, options.readerSource)
                    assertEquals(typeof (file as any).close, 'function')
                    await TestUtilities.utils.delay(0)
                    return 0
                  } as typeof copy,
                },
              })

              assertEquals(
                await targetFn({
                  ...options,
                  returnContent: true,
                }),
                {
                  contentFile,
                  pathFile: options.pathFile,
                  readerSource: options.readerSource,
                  appliedChmod: false,
                  appliedChown: false,
                  wroteFile: true,
                }
              )

              assertEquals(
                await targetFn({
                  ...options,
                  returnContent: false,
                }),
                {
                  contentFile: undefined,
                  pathFile: options.pathFile,
                  readerSource: options.readerSource,
                  appliedChmod: false,
                  appliedChown: false,
                  wroteFile: true,
                }
              )
            },
          })
        })

        group('failure', () => {
          test({
            name: 'option no contentFile or readerSource',
            async fn() {
              const { targetFn } = await getTargetFn()

              await assertRejects(
                () =>
                  targetFn({
                    pathFile: '',
                  }),
                Error,

                'Invariant, need to supply either contentFile or readerSource argument.'
              )
            },
          })
        })
      })
    })

    group('loadersModule', () => {
      group('dynamic test of all the keys', () => {
        ;(
          [
            {
              name: 'json',
              contentFile: '{ "hello": "two" }',
              expectedContentsResults: { hello: 'two' },
            },
            {
              name: 'yaml',
              contentFile: 'two: hello',
              expectedContentsResults: { two: 'hello' },
            },
            {
              name: 'toml',
              contentFile: "two = 'hello'",
              expectedContentsResults: { two: 'hello' },
            },
            {
              name: 'ts',
              contentFile:
                'export const two = "hello"; export const hello = "two";',
              expectedContentsResults: { hello: 'two', two: 'hello' },
            },
          ] as Array<{
            readonly name: keyof ClassMain['loadersModule']
            readonly contentFile: string
            readonly expectedContentsResults: TGenericObject
          }>
        ).forEach(({ name, contentFile, expectedContentsResults }) => {
          group('success', () => {
            test({
              name: `loadersModule.${name} from file`,
              async fn() {
                // ts has import keyword, that cannot be mocked right now so write a real file
                if (name === 'ts') {
                  return TestUtilities.utils.executeAndClean(
                    async ({ generateTempFilePath }) => {
                      const { pathFile } =
                        await contextTest.payloadInstance.instance.API.writeFile(
                          {
                            contentFile,
                            createDirectory: false,
                            pathFile: await generateTempFilePath(),
                          }
                        )

                      assertEquals(
                        await contextTest.payloadInstance.instance.loadersModule[
                          name
                        ]({ pathFile }),
                        expectedContentsResults
                      )
                    }
                  )
                } else {
                  const { instance } = await tf.getters.instance({
                    instanceMocks: {
                      API: {
                        readFileToString() {
                          return contentFile
                        },
                      },
                    },
                  })

                  assertEquals(
                    await instance.loadersModule[name]({
                      pathFile: contentFile,
                    }),
                    expectedContentsResults
                  )
                }
              },
            })

            test({
              name: `loadersModule.${name} from string`,
              async fn() {
                assertEquals(
                  await contextTest.payloadInstance.instance.loadersModule[
                    name
                  ]({
                    contentFile,
                  }),
                  expectedContentsResults
                )
              },
            })
          })

          group('failure', () => {
            test({
              name: `loadersModule.${name} missing arguments`,
              fn: async () => {
                await assertRejects(
                  () =>
                    contextTest.payloadInstance.instance.loadersModule[name](
                      {}
                    ),
                  Error,

                  ' - invariant, contentFile or pathFile is required as arguments.'
                )
              },
            })
          })
        })
      })
    })
  })
})
