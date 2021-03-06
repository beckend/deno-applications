import {
  assertEquals,
  assertThrowsAsync,
} from 'https://deno.land/std@0.99.0/testing/asserts.ts'

import { ShellCommand as ClassMain, ErrorShellCommandNotFound } from '../mod.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(ClassMain.name, () => {
  group('static', () => {
    group('API', () => {
      group('commandExists', () => {
        group('success', () => {
          test({
            name: 'command works',
            async fn() {
              const {
                status: { success },
              } = await ClassMain.API.commandExists({
                command: 'ls',
                throwOnFail: true,
              })

              assertEquals(success, true)
            },
          })

          test({
            name: 'command works',
            async fn() {
              const {
                status: { success },
              } = await ClassMain.API.commandExists({
                command: 'ls',
                throwOnFail: true,
              })

              assertEquals(success, true)
            },
          })
        })

        group('failure', () => {
          test({
            name: 'option throwOnFail true when command does not exist',
            async fn() {
              const TheResultingError = await assertThrowsAsync(() =>
                ClassMain.API.commandExists({
                  command: 'command_does-not-exist',
                  throwOnFail: true,
                })
              )

              assertEquals(
                TheResultingError instanceof ErrorShellCommandNotFound,
                true
              )
              assertEquals(
                TheResultingError.message,
                'command "command_does-not-exist" is not available using ===> /bin/bash --login -c command -v command_does-not-exist'
              )
            },
          })

          test({
            name: 'option throwOnFail false when command does not exist',
            async fn() {
              const {
                status: { success },
              } = await ClassMain.API.commandExists({
                command: 'command_does-not-exist',
                throwOnFail: false,
              })

              assertEquals(success, false)
            },
          })
        })
      })

      group('commandExistsMulti', () => {
        group('success', () => {
          test({
            name: 'when multiple commands exist',
            async fn() {
              const results = await ClassMain.API.commandExistsMulti({
                commands: ['ls', 'rm'],
                throwOnFail: true,
              })

              assertEquals(results.dataArray.length === 2, true)
              assertEquals(Object.values(results.dataObject).length === 2, true)

              results.dataArray.forEach(({ status: { success } }) => {
                assertEquals(success, true)
              })
            },
          })
        })

        group('failure', () => {
          test({
            name: 'option throwOnFail true when commands does not exist',
            async fn() {
              const TheResultingError = await assertThrowsAsync(() =>
                ClassMain.API.commandExistsMulti({
                  commands: ['ls', 'rm', 'ls2', 'rm2'],
                  throwOnFail: true,
                })
              )

              assertEquals(
                TheResultingError instanceof ErrorShellCommandNotFound,
                true
              )
            },
          })

          test({
            name: 'option throwOnFail false when commands does not exist',
            async fn() {
              const results = await ClassMain.API.commandExistsMulti({
                commands: ['ls', 'rm', 'ls2', 'rm2'],
                throwOnFail: false,
              })

              assertEquals(results.dataArray.length === 4, true)
              assertEquals(Object.values(results.dataObject).length === 4, true)
              assertEquals(results.dataArrayError.length === 2, true)
              assertEquals(
                Object.values(results.dataObjectError).length === 2,
                true
              )
            },
          })
        })
      })

      group('checkRequiredCommands', () => {
        group('success', () => {
          test({
            name: 'when commands exists',
            async fn() {
              const results = await ClassMain.API.checkRequiredCommands({
                commandsSpecification: {
                  ls: {
                    messageError: 'ls was not found',
                  },
                  rm: {
                    messageError: 'rm was not found',
                  },
                },
              })

              assertEquals(results.dataArray.length === 2, true)
              assertEquals(Object.values(results.dataObject).length === 2, true)
              assertEquals(results.dataArrayError.length === 0, true)
              assertEquals(
                Object.values(results.dataObjectError).length === 0,
                true
              )
            },
          })
        })

        group('failure', () => {
          test({
            name: 'when no valid arguments supplied',
            async fn() {
              const TheResultingError = await assertThrowsAsync(() =>
                ClassMain.API.checkRequiredCommands({
                  commandsSpecification: {},
                })
              )

              assertEquals(
                TheResultingError.message,
                'No commands supplied as keys.'
              )
            },
          })

          test({
            name: 'when no valid arguments supplied',
            async fn() {
              const TheResultingError = await assertThrowsAsync(() =>
                ClassMain.API.checkRequiredCommands({
                  commandsSpecification: {
                    ls3: {
                      messageError: 'ls was not found',
                    },
                    rm3: {
                      messageError: 'rm was not found',
                    },
                  },
                })
              )

              assertEquals(
                TheResultingError instanceof ErrorShellCommandNotFound,
                true
              )
            },
          })
        })
      })
    })
  })
})
