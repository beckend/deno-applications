// deno-lint-ignore-file no-extra-semi no-explicit-any
import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.152.0/testing/asserts.ts'
import { copy } from 'https://deno.land/std@0.152.0/streams/conversion.ts'

import { group, test } from '../../../modules/test-hooks/mod.ts'
import { GeneratorTemplates as ClassMain } from '../main.ts'
import { TestUtilities } from '../../../modules/test-utilities/mod.ts'

group(ClassMain.name, () => {
  const tf = new TestUtilities({
    getComponent: () => ClassMain,
  })

  group('CLI mod', () => {
    test({
      name: 'works',
      async fn() {
        await import('../mod.ts')
      },
    })
  })

  group('instance', () => {
    group('checks', () => {
      group('engine', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.checks.engine,
          }
        }

        test({
          name: 'throws',
          fn: () =>
            assertRejects(
              async () => {
                ;(await getTargetFn()).targetFn({
                  nameEngine: 'dsadasdsdsd',
                })
              },

              Error,

              'template engine: "dsadasdsdsd" is not available, use one of: "ejs"'
            ),
        })

        test({
          name: 'no throw',
          fn() {
            return getTargetFn().then(({ targetFn }) =>
              targetFn({
                nameEngine: 'ejs',
              })
            )
          },
        })
      })

      group('vars', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.checks.vars,
          }
        }

        group('success', () => {
          test({
            name: 'no errors',
            fn() {
              return getTargetFn().then(({ targetFn }) =>
                targetFn({
                  vars: '1',
                  varsType: '1',
                })
              )
            },
          })
        })

        group('failure', () => {
          test({
            name: 'missing vars',
            fn: () =>
              assertRejects(
                async () => {
                  ;(await getTargetFn()).targetFn({
                    varsType: '1',
                  })
                },
                Error,

                '--vars-type is provided but missing --vars'
              ),
          }),
            test({
              name: 'missing varsType',
              fn: () =>
                assertRejects(
                  async () => {
                    ;(await getTargetFn()).targetFn({
                      vars: '1',
                    })
                  },
                  Error,

                  '--vars was provided but missing --vars-type'
                ),
            })
        })
      })

      group('source', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.checks.source,
          }
        }

        group('success', () => {
          test({
            name: 'source as path to a file',
            async fn() {
              const { instance, targetFn } = await getTargetFn()
              const expected = {
                source: 'does-not-matter',
                contentFile: 'contentFile',
              }

              instance.DH.dependenciesSet({
                Deno: {
                  readTextFile: async function (pathFile) {
                    assertEquals(pathFile, expected.source)
                    await TestUtilities.utils.delay(0)
                    return expected.contentFile
                  } as typeof Deno.readTextFile,
                } as any,
              })

              assertEquals(
                await targetFn({
                  source: expected.source,
                }),
                {
                  pathFile: expected.source,
                  contentFile: expected.contentFile,
                }
              )
            },
          })
        })

        test({
          name: 'source as string',
          async fn() {
            const { instance, targetFn } = await getTargetFn()
            const expected = {
              source: 'does-not-matter',
              contentFile: 'contentFile',
            }

            instance.DH.dependenciesSet({
              Deno: {
                readTextFile: async function (pathFile) {
                  assertEquals(pathFile, expected.source)
                  await TestUtilities.utils.delay(0)
                  throw new Error('nope')
                } as typeof Deno.readTextFile,
              } as any,
            })

            assertEquals(
              await targetFn({
                source: expected.source,
              }),
              {
                pathFile: undefined,
                contentFile: expected.source,
              }
            )
          },
        })

        group('failure', () => {
          test({
            name: 'wrong arguments',
            fn: () =>
              assertRejects(
                () =>
                  getTargetFn().then(({ targetFn }) =>
                    targetFn({ source: undefined })
                  ),
                Error,
                '--source is required as string or file path'
              ),
          })
        })
      })
    })

    group('handlersCMD', () => {
      group('vars', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.handlersCMD.vars,
          }
        }

        group('success', () => {
          test({
            name: 'vars as plain object',
            async fn() {
              const { targetFn } = await getTargetFn()
              const dataTests = {
                vars: {
                  hello: 2,
                },
                varsType: 'plain',
                returned: 'returned',
              }

              assertEquals(
                await targetFn({
                  vars: dataTests.vars,
                  varsType: 'plain',
                }),
                dataTests.vars
              )
            },
          })

          test({
            name: 'vars as path to file',
            async fn() {
              const { instance, targetFn } = await getTargetFn()
              const mocks = {
                spyFileHandlerLoadersModuleTS: TestUtilities.utils.mock.spy(),
              }
              const expected = {
                vars: '/path/to/my/vars.ts',
                returned: 'returned',
              }

              instance.DH.dependenciesSet({
                fileHandler: {
                  loadersModule: {
                    ts(x: any) {
                      mocks.spyFileHandlerLoadersModuleTS(x)
                      return expected.returned
                    },
                  },
                } as any,
              })

              assertEquals(
                await targetFn({
                  vars: expected.vars,
                }),
                expected.returned
              )

              assertEquals(
                mocks.spyFileHandlerLoadersModuleTS.calls[0].args[0],
                {
                  pathFile: expected.vars,
                }
              )
            },
          })

          test({
            name: 'vars as string content and supplied varsType',
            async fn() {
              const { instance, targetFn } = await getTargetFn()
              const mocks = {
                spyFileHandlerLoadersModuleTS: TestUtilities.utils.mock.spy(),
              }
              const expected = {
                vars: 'my content',
                varsType: 'ts',
                returned: 'returned',
              }

              instance.DH.dependenciesSet({
                fileHandler: {
                  loadersModule: {
                    ts(x: any) {
                      mocks.spyFileHandlerLoadersModuleTS(x)
                      return expected.returned
                    },
                  },
                } as any,
              })

              assertEquals(
                await targetFn({
                  vars: expected.vars,
                  varsType: expected.varsType,
                }),
                expected.returned
              )

              assertEquals(
                mocks.spyFileHandlerLoadersModuleTS.calls[0].args[0],
                {
                  contentFile: expected.vars,
                }
              )
            },
          })

          test({
            name: 'no file extension detected',
            async fn() {
              const { targetFn } = await getTargetFn()
              const expected = {
                returned: {},
              }

              assertEquals(
                await targetFn({
                  vars: '/path/to/my/vars/x',
                }),
                expected.returned
              )

              assertEquals(
                await targetFn({
                  vars: 'const hello = 2',
                }),
                expected.returned
              )

              assertEquals(
                await targetFn({
                  vars: 'gn kf2j1- ',
                }),
                expected.returned
              )
            },
          })
        })

        group('failure', () => {
          test({
            name: 'var handlers to handle unknown file extension',
            async fn() {
              const { targetFn } = await getTargetFn()

              await Promise.all([
                assertRejects(
                  async () => {
                    await targetFn({
                      vars: '/path/to/my/vars/x.wut',
                    })
                  },
                  Error,

                  'No function to handle detected extension:'
                ),

                assertRejects(
                  async () => {
                    await targetFn({
                      vars: 'const hello = 2',
                      varsType: 'what',
                    })
                  },
                  Error,

                  'No function to handle detected extension:'
                ),
              ])
            },
          })
        })
      })
    })

    group('handlersTemplate', () => {
      group('output', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.handlersTemplate.output,
          }
        }

        group('success', () => {
          test({
            name: 'by option fileOutput and option templateReader',
            async fn() {
              const { instance, targetFn } = await getTargetFn()
              const mocks = {
                spyFilehandlerAPIWriteFile: TestUtilities.utils.mock.spy(),
              }
              const dataTests = {
                fileOutput: '/tmp/hello.out',
                fileOutputCreateDirectory: true,
                templateReader: 'templateReader',
              }

              instance.DH.dependenciesSet({
                fileHandler: {
                  API: {
                    writeFile: async function (options: any) {
                      mocks.spyFilehandlerAPIWriteFile(options)
                      await TestUtilities.utils.delay(0)
                      return {
                        contentFile: dataTests.templateReader,
                        readerSource: dataTests.templateReader,
                      }
                    },
                  },
                } as any,
              })

              // @TODO verify console.log when a lib is available or a custom one is made
              assertEquals(
                await targetFn({
                  fileOutput: dataTests.fileOutput,
                  fileOutputCreateDirectory:
                    dataTests.fileOutputCreateDirectory,
                  templateReader: dataTests.templateReader as any,
                }),
                {
                  templateString: dataTests.templateReader,
                  templateReader: dataTests.templateReader,
                }
              )
            },
          })

          test({
            name: 'by option templateReader and no option fileOutput',
            async fn() {
              const { instance, targetFn } = await getTargetFn()
              const dataTests = {
                fileOutputCreateDirectory: true,
                templateReader: 'templateReader',
              }

              instance.DH.dependenciesSet({
                Deno: {
                  stdout: 'stdout' as any,
                },

                stream: {
                  copy: async function (src, dest) {
                    assertEquals(src, dataTests.templateReader)
                    assertEquals(dest, 'stdout')
                    await TestUtilities.utils.delay(0)
                    return 0
                  } as typeof copy,
                },
              })

              // @TODO verify console.log when a lib is available or a custom one is made
              assertEquals(
                await targetFn({
                  fileOutputCreateDirectory:
                    dataTests.fileOutputCreateDirectory,
                  templateReader: dataTests.templateReader as any,
                }),
                {
                  templateReader: dataTests.templateReader,
                }
              )
            },
          })

          test({
            name: 'by option fileOutput and option templateString',
            async fn() {
              const { instance, targetFn } = await getTargetFn()
              const mocks = {
                spyFilehandlerAPIWriteFile: TestUtilities.utils.mock.spy(),
              }
              const dataTests = {
                fileOutput: '/tmp/hello.out',
                fileOutputCreateDirectory: true,
                templateString: 'templateString',
              }

              instance.DH.dependenciesSet({
                fileHandler: {
                  API: {
                    writeFile: async function (options: any) {
                      mocks.spyFilehandlerAPIWriteFile(options)
                      await TestUtilities.utils.delay(0)
                      return {
                        contentFile: dataTests.templateString,
                      }
                    },
                  },
                } as any,
              })

              // @TODO verify console.log when a lib is available or a custom one is made
              assertEquals(
                await targetFn({
                  fileOutput: dataTests.fileOutput,
                  fileOutputCreateDirectory:
                    dataTests.fileOutputCreateDirectory,
                  templateString: dataTests.templateString,
                }),
                {
                  templateString: dataTests.templateString,
                }
              )
            },
          })

          test({
            name: 'by option templateString and no option fileOutput',
            async fn() {
              const { targetFn } = await getTargetFn()
              const dataTests = {
                fileOutputCreateDirectory: true,
                templateString: 'templateString',
              }

              // @TODO verify console.log when a lib is available or a custom one is made
              assertEquals(
                await targetFn({
                  fileOutputCreateDirectory:
                    dataTests.fileOutputCreateDirectory,
                  templateString: dataTests.templateString,
                }),
                {
                  templateString: dataTests.templateString,
                }
              )
            },
          })
        })

        group('failure', () => {
          test({
            name: 'no options fileOutput and templateReader',
            async fn() {
              const { targetFn } = await getTargetFn()
              const dataTests = {
                fileOutputCreateDirectory: true,
              }

              return assertRejects(
                async () => {
                  await assertEquals(
                    await targetFn({
                      fileOutputCreateDirectory:
                        dataTests.fileOutputCreateDirectory,
                    }),
                    undefined
                  )
                },
                Error,

                'No template output source provided in arguments.'
              )
            },
          })
        })
      })
    })

    group('API', () => {
      group('generate', () => {
        const getTargetFn = async () => {
          const payload = await tf.getters.instance()

          return {
            ...payload,
            targetFn: payload.instance.API.generate,
          }
        }

        test({
          name: 'works',
          async fn() {
            const { instance, targetFn } = await getTargetFn()
            const mocks = {
              spyEnginesEJSGenerate: TestUtilities.utils.mock.spy(),
            }
            const expected = {
              source: 'does-not-matter',
              contentFile: 'contentFile',
            }

            instance.DH.dependenciesSet({
              Deno: {
                readTextFile: async function (pathFile) {
                  assertEquals(pathFile, expected.source)
                  await TestUtilities.utils.delay(0)
                  return expected.contentFile
                } as typeof Deno.readTextFile,
              } as any,

              enginesAvailable: {
                ejs: {
                  class: class MockTemplateGenerator {
                    generateTemplate = mocks.spyEnginesEJSGenerate
                  } as any,
                },
              },
            })

            const stubhandlersTemplateOutput = TestUtilities.utils.mock.stub(
              instance.handlersTemplate,
              'output'
            )

            assertEquals(
              await targetFn({
                engine: 'ejs',
                source: 'does-not-matter',
                vars: {},
              }),
              undefined
            )

            assertEquals(
              typeof stubhandlersTemplateOutput.calls[0].args[0],
              'object'
            )
            assertEquals(
              mocks.spyEnginesEJSGenerate.calls[0].args[0].contentFile,
              expected.contentFile
            )
            assertEquals(
              mocks.spyEnginesEJSGenerate.calls[0].args[0].pathFile,
              expected.source
            )
          },
        })
      })
    })

    group('init', () => {
      const getTargetFn = async () => {
        const payload = await tf.getters.instance()

        return {
          ...payload,
          targetFn: payload.instance.init,
        }
      }

      group('success', () => {
        test({
          name: 'works with ARGV or without',
          async fn() {
            const { targetFn } = await getTargetFn()

            // @TODO console verify
            await Promise.all([
              targetFn({}),

              targetFn({
                ARGV: ['--help'],
              }),
            ])
          },
        })

        test({
          name: 'trigger generate function',
          async fn() {
            const { targetFn } = await getTargetFn()

            // @TODO console verify
            await targetFn({
              ARGV: [
                'generate',
                '--source=<% if (user) { %><h2><%= user.name %></h2><% } %>',
                '--vars={ "user": { "name": "admin" } }',
                '--vars-type=json',
                '--engine=ejs',
              ],
            })
          },
        })
      })
    })
  })
})
