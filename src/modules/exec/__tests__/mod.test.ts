// deno-lint-ignore-file no-extra-semi no-explicit-any
import {
  assertEquals,
  assertStringIncludes,
  assertRejects,
} from 'https://deno.land/std@0.152.0/testing/asserts.ts'

import { group, test } from '../../test-hooks/mod.ts'
import { Exec as ClassMain, IOutputMode } from '../mod.ts'

group(ClassMain.name, () => {
  const testHelpers = {
    asserts: {
      resultsWithEnv<
        T1 extends {
          env: {
            [x: string]: any
          }
        }
      >(x: T1) {
        if (x?.env) {
          assertEquals(Object.keys(x.env).length > 0, true)
          x.env = {}
        }

        return x
      },
    },
  }

  group('static', () => {
    group('getters', () => {
      group('command', () => {
        group('success', () => {
          ;(
            [
              {
                name: 'command as string and spaces',
                input: {
                  command: '       ls             -lah        ',
                },
                expected: ['ls', '-lah'],
              },
              {
                name: 'command as array and spaces',
                input: {
                  command: ['       ls ', '  -lah'],
                },
                expected: ['ls', '-lah'],
              },
              {
                name: 'command as array and option withShell and option withShellOptions',
                input: {
                  command: ['ls', '-lah', '/'],
                  withShell: true,
                  withShellOptions: {
                    doLogin: true,
                    shellFullPath: '/bin/bash',
                    shellOptions: '-x',
                  },
                },
                expected: ['/bin/bash', '--login', '-x', '-c', 'ls -lah /'],
              },
              {
                name: 'command as string and option withShell and option withShellOptions',
                input: {
                  command: 'ls -lah /',
                  withShell: true,
                  withShellOptions: {
                    doLogin: true,
                    shellFullPath: '/bin/bash',
                    shellOptions: '-x',
                  },
                },
                expected: ['/bin/bash', '--login', '-x', '-c', 'ls -lah /'],
              },
              {
                name: 'command as string and option withShell and pipe',
                input: {
                  command: `nmap --script broadcast-dhcp-discover --script-args "broadcast-dhcp-discover.timeout=3" -e wan0 | grep -i 'domain name server' | awk -F'Server:' '{print $2}'`,
                  withShell: true,
                },
                expected: [
                  `nmap --script broadcast-dhcp-discover --script-args "broadcast-dhcp-discover.timeout=3" -e wan0 | grep -i 'domain name server' | awk -F'Server:' '{print $2}'`,
                ],
                exec: false,
              },
            ] as Array<{
              readonly name: string
              readonly input: Parameters<
                typeof ClassMain['getters']['command']
              >[0]
              readonly expected: ReturnType<
                typeof ClassMain['getters']['command']
              >
              readonly exec?: boolean
            }>
          ).forEach(({ exec, expected, input, name }) => {
            test({
              name,
              async fn() {
                const commandExec = ClassMain.getters.command(input)

                assertEquals(commandExec, expected)

                exec &&
                  assertEquals(
                    (
                      await ClassMain.API.exec({
                        getCommand: () => commandExec,
                        modeOutput: IOutputMode.Capture,
                      })
                    ).status.success,
                    true
                  )
              },
            })
          })
        })
      })
    })
    group('utils', () => {
      group('splitCommand', () => {
        group('success', () => {
          ;(
            [
              {
                command: `  /bin/bash -c "find ./ -iname '*.ts' -type f -print0 | xargs --null -i bash -c 'deno lint --unstable --json {}'"  `,
                expected: [
                  '/bin/bash',
                  '-c',
                  `find ./ -iname '*.ts' -type f -print0 | xargs --null -i bash -c 'deno lint --unstable --json {}'`,
                ],
              },
              {
                command: ` ls   -lah      /tmp  `,
                expected: ['ls', '-lah', '/tmp'],
              },
              {
                command: `        sudo  rm      -rf /       &&   echo  "Great success"         `,
                expected: [
                  'sudo',
                  'rm',
                  '-rf',
                  '/',
                  '&&',
                  'echo',
                  'Great success',
                ],
              },
            ] as Array<{
              readonly command: string
              readonly expected: Array<string>
            }>
          ).forEach(({ command, expected }) => {
            test({
              name: `splits correctly into ===> ${expected.join(' ')}`,
              fn() {
                assertEquals(
                  ClassMain.utils.splitCommand({
                    command,
                  }),
                  expected
                )
              },
            })
          })
        })
      })
    })

    group('API', () => {
      group('exec', () => {
        group('success', () => {
          group(
            'option modeOutput and options optionsRun stdout/stderr to piped and command as string and array',
            () => {}
          )
          ;[
            {
              command: 'echo hello',
              modeOutput: IOutputMode.None,
              expected: {
                command: {
                  array: ['echo', 'hello'],
                  string: 'echo hello',
                },
                env: {},
                outputs: {
                  stdErr: '',
                  stdOut: '',
                },
              },
            },
            {
              command: ['echo', 'hello'],
              modeOutput: IOutputMode.StdOutErr,
              expected: {
                command: {
                  array: ['echo', 'hello'],
                  string: 'echo hello',
                },
                env: {},
                outputs: {
                  stdErr: '',
                  stdOut: '',
                },
              },
            },
            {
              command: 'echo hello',
              modeOutput: IOutputMode.Capture,
              expected: {
                command: {
                  array: ['echo', 'hello'],
                  string: 'echo hello',
                },
                env: {},
                outputs: {
                  stdErr: '',
                  stdOut: 'hello',
                },
              },
            },
            {
              command: ['echo', 'hello'],
              modeOutput: IOutputMode.StdOutErr,
              expected: {
                command: {
                  array: ['echo', 'hello'],
                  string: 'echo hello',
                },
                env: {},
                outputs: {
                  stdErr: '',
                  stdOut: '',
                },
              },
            },
          ].forEach(({ command, modeOutput, expected }) => {
            test({
              name: modeOutput,
              async fn() {
                assertEquals(
                  testHelpers.asserts.resultsWithEnv(
                    await ClassMain.API.exec({
                      getCommand: () => command,
                      modeOutput,
                    })
                  ),
                  {
                    ...expected,
                    status: {
                      code: 0,
                      success: true,
                    },
                  }
                )
              },
            })
          })

          group('option optionsRun', () => {
            test({
              name: 'stdout/stderr inherit and modeOutput capture',
              async fn() {
                assertEquals(
                  testHelpers.asserts.resultsWithEnv(
                    await ClassMain.API.exec({
                      getCommand: () => 'echo hello',
                      modeOutput: IOutputMode.Capture,
                      optionsRun: {
                        stdout: 'inherit',
                        stderr: 'inherit',
                      },
                    })
                  ),
                  {
                    command: {
                      array: ['echo', 'hello'],
                      string: 'echo hello',
                    },
                    env: {},
                    outputs: {
                      stdErr: '',
                      stdOut: '',
                    },
                    status: {
                      code: 0,
                      success: true,
                    },
                  }
                )
              },
            })
          })

          test({
            name: 'option withEnv to non default',
            async fn() {
              assertEquals(
                testHelpers.asserts.resultsWithEnv(
                  await ClassMain.API.exec({
                    getCommand: () => `/bin/bash -c "echo 'test'"`,
                    modeOutput: IOutputMode.Capture,
                  })
                ),
                {
                  command: {
                    array: ['/bin/bash', '-c', "echo 'test'"],
                    string: "/bin/bash -c echo 'test'",
                  },
                  env: {},
                  outputs: {
                    stdErr: '',
                    stdOut: 'test',
                  },
                  status: {
                    code: 0,
                    success: true,
                  },
                }
              )
            },
          })

          test({
            name: 'option trimOutputs to non default',
            async fn() {
              assertEquals(
                testHelpers.asserts.resultsWithEnv(
                  await ClassMain.API.exec({
                    getCommand: () =>
                      `/usr/bin/sh -c "echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'"`,
                    modeOutput: IOutputMode.Capture,
                    trimOutputs: false,
                  })
                ),
                {
                  command: {
                    array: [
                      '/usr/bin/sh',
                      '-c',
                      "echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'",
                    ],
                    string:
                      "/usr/bin/sh -c echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'",
                  },
                  env: {},
                  outputs: {
                    stdErr: '',
                    stdOut: 'test me hey ho\n',
                  },
                  status: {
                    code: 0,
                    success: true,
                  },
                }
              )
            },
          })

          test({
            name: 'stdout/stderr null and modeOutput capture',
            async fn() {
              assertEquals(
                testHelpers.asserts.resultsWithEnv(
                  await ClassMain.API.exec({
                    getCommand: () => 'echo hello',
                    modeOutput: IOutputMode.Capture,
                    optionsRun: {
                      stdout: 'null',
                      stderr: 'null',
                    },
                  })
                ),
                {
                  command: {
                    array: ['echo', 'hello'],
                    string: 'echo hello',
                  },
                  env: {},
                  outputs: {
                    stdErr: '',
                    stdOut: '',
                  },
                  status: {
                    code: 0,
                    success: true,
                  },
                }
              )
            },
          })

          test({
            name: 'can do pipes',
            async fn() {
              assertEquals(
                testHelpers.asserts.resultsWithEnv(
                  await ClassMain.API.exec({
                    getCommand: () =>
                      `/usr/bin/sh -c "echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'"`,
                    modeOutput: IOutputMode.Capture,
                  })
                ),
                {
                  command: {
                    array: [
                      '/usr/bin/sh',
                      '-c',
                      "echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'",
                    ],
                    string:
                      "/usr/bin/sh -c echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'",
                  },
                  env: {},
                  outputs: {
                    stdErr: '',
                    stdOut: 'test me hey ho',
                  },
                  status: {
                    code: 0,
                    success: true,
                  },
                }
              )
            },
          })

          test({
            name: 'option withShellOptions',
            async fn() {
              assertEquals(
                testHelpers.asserts.resultsWithEnv(
                  await ClassMain.API.exec({
                    getCommand: () =>
                      `echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'`,
                    modeOutput: IOutputMode.Capture,
                    withShell: true,
                  })
                ),
                {
                  command: {
                    array: [
                      '/bin/bash',
                      '--login',
                      '-c',
                      "echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'",
                    ],
                    string:
                      "/bin/bash --login -c echo 'test me hey ho' | grep -i 'hey' | grep -i 'ho'",
                  },
                  env: {},
                  outputs: {
                    stdErr: '',
                    stdOut: 'test me hey ho',
                  },
                  status: {
                    code: 0,
                    success: true,
                  },
                }
              )
            },
          })
        })

        group('failure', () => {
          group('stderr', () => {
            test({
              name: 'modeOutput capture',
              async fn() {
                const results = testHelpers.asserts.resultsWithEnv(
                  await ClassMain.API.exec({
                    getCommand: () => '/usr/bin/sh -c "sed -e"',
                    modeOutput: IOutputMode.Capture,
                    throwOnCommandError: false,
                  })
                )

                assertStringIncludes(
                  results.outputs.stdErr,
                  'option requires an argument'
                )
                results.outputs.stdErr = ''

                assertEquals(results, {
                  command: {
                    array: ['/usr/bin/sh', '-c', 'sed -e'],
                    string: '/usr/bin/sh -c sed -e',
                  },
                  env: {},
                  outputs: {
                    stdErr: '',
                    stdOut: '',
                  },
                  status: {
                    code: 1,
                    success: false,
                  },
                })
              },
            })

            test({
              name: 'option throwOnCommandError non default',
              fn: () =>
                assertRejects(
                  () =>
                    ClassMain.API.exec({
                      getCommand: () => '/usr/bin/sh -c "sed -e"',
                      modeOutput: IOutputMode.Capture,
                      throwOnCommandError: true,
                    }),
                  Error,

                  'command failed ===> /usr/bin/sh -c sed -e'
                ),
            })
          })
        })
      })

      group('execMulti', () => {
        group('success', () => {
          test({
            name: 'passes env by ID in, getCommand as array',
            async fn() {
              const results = await ClassMain.API.execMulti({
                getCommands() {
                  return [
                    {
                      getCommand: () => 'echo hello',
                      ID: 'ID_1',
                    },

                    {
                      getCommand: () => 'echo "${ID_1} world?"',
                      ID: 'ID_2',
                    },

                    {
                      getCommand: () => 'echo "${ID_2} or was it werld?"',
                      ID: 'ID_3',
                    },
                  ]
                },
              })

              // first run will not have it's output
              assertEquals(results.dataArray[0].env.ID_1, undefined)
              assertEquals(results.dataObject.ID_1.env.ID_1, undefined)

              assertEquals(results.dataArray[1].env.ID_1, 'hello')
              assertEquals(results.dataObject.ID_2.env.ID_1, 'hello')

              assertEquals(results.dataArray[2].env.ID_2, 'hello world?')
              assertEquals(results.dataObject.ID_3.env.ID_2, 'hello world?')

              assertEquals(results.envAdded, {
                ID_1: 'hello',
                ID_2: 'hello world?',
                ID_3: 'hello world? or was it werld?',
              })

              assertEquals(results.dataArray.length, 3)
              assertEquals(Object.keys(results.dataObject).length, 3)

              const expect1 = {
                command: {
                  array: ['/bin/bash', '--login', '-c', 'echo hello'],
                  string: '/bin/bash --login -c echo hello',
                },
                env: {},
                outputs: {
                  stdErr: '',
                  stdOut: 'hello',
                },
                status: {
                  code: 0,
                  success: true,
                },
              }
              assertEquals(
                testHelpers.asserts.resultsWithEnv(results.dataArray[0]),
                expect1
              )
              assertEquals(results.dataObject.ID_1, expect1)

              const expect2 = {
                command: {
                  array: [
                    '/bin/bash',
                    '--login',
                    '-c',
                    'echo "${ID_1} world?"',
                  ],
                  string: '/bin/bash --login -c echo "${ID_1} world?"',
                },
                env: {},
                outputs: {
                  stdErr: '',
                  stdOut: 'hello world?',
                },
                status: {
                  code: 0,
                  success: true,
                },
              }
              assertEquals(
                testHelpers.asserts.resultsWithEnv(results.dataArray[1]),
                expect2
              )
              assertEquals(results.dataObject.ID_2, expect2)

              const expect3 = {
                command: {
                  array: [
                    '/bin/bash',
                    '--login',
                    '-c',
                    'echo "${ID_2} or was it werld?"',
                  ],
                  string:
                    '/bin/bash --login -c echo "${ID_2} or was it werld?"',
                },
                env: {},
                outputs: {
                  stdErr: '',
                  stdOut: 'hello world? or was it werld?',
                },
                status: {
                  code: 0,
                  success: true,
                },
              }
              assertEquals(
                testHelpers.asserts.resultsWithEnv(results.dataArray[2]),
                expect3
              )
              assertEquals(results.dataObject.ID_3, expect3)
            },
          })

          group('option getCommands', () => {
            test({
              name: 'command argument as string and string array',
              async fn() {
                const results = await Promise.all(
                  [
                    { command: 'echo hello' },
                    { command: ['echo', 'hello'] },
                  ].map(() =>
                    ClassMain.API.execMulti({
                      getCommands: () => ['echo hello', ['echo', 'hello']],
                    })
                  )
                )

                results.forEach((dataObject) => {
                  assertEquals(dataObject.envAdded, {
                    ___EXEC___0: 'hello',
                    ___EXEC___1: 'hello',
                  })
                })
              },
            })

            test({
              name: 'getCommand using parameter IDPreviousCommand',
              async fn() {
                const results = await ClassMain.API.execMulti({
                  getCommands({ defaults }) {
                    return [
                      'echo hello',
                      {
                        getCommand: ({ IDCommandPrevious }) =>
                          `echo $\{${IDCommandPrevious}\} world`,
                      },
                      `echo $\{${defaults.IDAutoPrefix}1\} ok`,
                      {
                        getCommand: ({ IDCommandPrevious }) =>
                          `echo $\{${IDCommandPrevious}\} is`,
                        ID: '_MY_ID_0',
                      },
                      `echo $\{_MY_ID_0\} ok`,
                      `echo $\{${defaults.IDAutoPrefix}3\} maybe...`,
                    ]
                  },
                })

                assertEquals(results.envAdded, {
                  ___EXEC___0: 'hello',
                  ___EXEC___1: 'hello world',
                  ___EXEC___2: 'hello world ok',
                  _MY_ID_0: 'hello world is',
                  ___EXEC___3: 'hello world is ok',
                  ___EXEC___4: 'hello world is ok maybe...',
                })
              },
            })

            test({
              name: 'getCommand as array with autoID',
              async fn() {
                const results = await ClassMain.API.execMulti({
                  getCommands({ defaults }) {
                    return [
                      'echo hello',
                      `echo $\{${defaults.IDAutoPrefix}0\} world`,
                      `echo $\{${defaults.IDAutoPrefix}1\} ok`,
                    ]
                  },
                })

                assertEquals(results.envAdded, {
                  ___EXEC___0: 'hello',
                  ___EXEC___1: 'hello world',
                  ___EXEC___2: 'hello world ok',
                })
              },
            })
          })

          group('option onBeforeCommand', () => {
            test({
              name: "option onBeforeCommand and it's return break",
              async fn() {
                const results = await ClassMain.API.execMulti({
                  getCommands() {
                    return [
                      {
                        ID: 'ID_1',
                        getCommand: () => 'echo hello',
                        onBeforeCommand(result) {
                          assertEquals(result.dataArray.length, 0)
                          assertEquals(Object.keys(result.dataObject).length, 0)
                          assertEquals(result.envAdded, {})
                          assertEquals(result.dataArray.length, 0)
                          return {
                            break: true,
                          }
                        },
                      },
                    ]
                  },
                })

                assertEquals(results.dataArray.length, 0)
                assertEquals(Object.keys(results.dataObject).length, 0)
                assertEquals(results.envAdded, {})
              },
            })

            test({
              name: "option onBeforeCommand and it's return continue",
              async fn() {
                const results = await ClassMain.API.execMulti({
                  getCommands() {
                    return [
                      {
                        ID: 'ID_1',
                        getCommand: () => 'echo hello',
                        onBeforeCommand(result) {
                          assertEquals(result.dataArray.length, 0)
                          assertEquals(Object.keys(result.dataObject).length, 0)
                          assertEquals(result.envAdded, {})
                          assertEquals(result.dataArray.length, 0)
                          return {
                            continue: true,
                          }
                        },
                      },
                    ]
                  },
                })

                assertEquals(results.dataArray.length, 0)
                assertEquals(Object.keys(results.dataObject).length, 0)
                assertEquals(results.envAdded, {})
              },
            })
          })

          group('option onAfterCommand', () => {
            test({
              name: "option onAfterCommand and it's return break",
              async fn() {
                const results = await ClassMain.API.execMulti({
                  getCommands() {
                    return [
                      {
                        ID: 'ID_1',
                        getCommand: () => 'echo hello',
                        onAfterCommand(result) {
                          assertEquals(result.dataArray.length, 1)
                          assertEquals(Object.keys(result.dataObject).length, 1)
                          assertEquals(result.envAdded, {
                            ID_1: 'hello',
                          })

                          assertEquals(
                            testHelpers.asserts.resultsWithEnv(
                              result.dataArray[0]
                            ),
                            {
                              command: {
                                array: [
                                  '/bin/bash',
                                  '--login',
                                  '-c',
                                  'echo hello',
                                ],
                                string: '/bin/bash --login -c echo hello',
                              },
                              env: {},
                              outputs: {
                                stdErr: '',
                                stdOut: 'hello',
                              },
                              status: {
                                code: 0,
                                success: true,
                              },
                            }
                          )
                        },
                      },

                      {
                        ID: 'ID_2',
                        getCommand: () => 'echo "${ID_1} world?"',
                        onAfterCommand(result) {
                          assertEquals(result.envAdded, {
                            ID_1: 'hello',
                            ID_2: 'hello world?',
                          })

                          return {
                            break: true,
                          }
                        },
                      },
                    ]
                  },
                })

                assertEquals(results.dataArray.length, 2)
                assertEquals(Object.keys(results.dataObject).length, 2)
                assertEquals(results.envAdded, {
                  ID_1: 'hello',
                  ID_2: 'hello world?',
                })
              },
            })

            test({
              name: "option onAfterCommand and it's return continue",
              async fn() {
                const results = await ClassMain.API.execMulti({
                  getCommands() {
                    return [
                      {
                        ID: 'ID_1',
                        getCommand: () => 'echo hello',
                        onAfterCommand(result) {
                          assertEquals(result.dataArray.length, 1)
                          assertEquals(Object.keys(result.dataObject).length, 1)
                          assertEquals(result.envAdded, {
                            ID_1: 'hello',
                          })

                          assertEquals(
                            testHelpers.asserts.resultsWithEnv(
                              result.dataArray[0]
                            ),
                            {
                              command: {
                                array: [
                                  '/bin/bash',
                                  '--login',
                                  '-c',
                                  'echo hello',
                                ],
                                string: '/bin/bash --login -c echo hello',
                              },
                              env: {},
                              outputs: {
                                stdErr: '',
                                stdOut: 'hello',
                              },
                              status: {
                                code: 0,
                                success: true,
                              },
                            }
                          )
                        },
                      },

                      {
                        ID: 'ID_2',
                        getCommand: () => 'echo "${ID_1} world?"',
                        onAfterCommand(result) {
                          assertEquals(result.envAdded, {
                            ID_1: 'hello',
                            ID_2: 'hello world?',
                          })

                          return {
                            continue: true,
                          }
                        },
                      },
                    ]
                  },
                })

                assertEquals(results.dataArray.length, 2)
                assertEquals(Object.keys(results.dataObject).length, 2)
                assertEquals(results.envAdded, {
                  ID_1: 'hello',
                  ID_2: 'hello world?',
                })
              },
            })
          })
        })

        group('failure', () => {
          test({
            name: 'duplicate ID',
            fn: () =>
              assertRejects(
                () =>
                  ClassMain.API.execMulti({
                    getCommands() {
                      return [
                        {
                          getCommand: () => 'echo hello',
                          ID: 'ID_1',
                        },

                        {
                          getCommand: () => 'echo "${ID_1} world?"',
                          ID: 'ID_1',
                        },
                      ]
                    },
                  }),
                Error,
                'ID: "ID_1" duplicate found'
              ),
          })
        })
      })
    })
  })
})
