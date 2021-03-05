import {
  assertEquals,
  assertThrowsAsync,
} from 'https://deno.land/std@0.114.0/testing/asserts.ts'

import { ShellUtilities as ClassMain } from '../shell-utilities.ts'
import { group, test } from '../../test-hooks/mod.ts'
import { Common } from './common.ts'

group(ClassMain.name, () => {
  group('static', () => {
    group('API', () => {
      group('checks', () => {
        group('requireRoot', () => {
          test({
            name: 'works',
            async fn() {
              await assertThrowsAsync(
                async () => {
                  await ClassMain.API.checks.requireRoot()
                },
                undefined,
                undefined,

                'root is required'
              )
            },
          })
        })
      })

      group('fs', () => {
        group('exists', () => {
          test({
            name: 'options thrownOnNotExist toggle',
            async fn() {
              assertEquals(
                await ClassMain.API.fs.exists({
                  pathFiles: ['/tmp'],
                }),
                [
                  {
                    exists: true,
                    pathFile: '/tmp',
                  },
                ]
              )

              await assertThrowsAsync(async () => {
                await ClassMain.API.fs.exists({
                  pathFiles: [
                    '/tmp/DOES-not-rewaly-Ex/123/423/xist/231512----___',
                  ],
                }),
                  undefined,
                  undefined,
                  '"/tmp/DOES-not-rewaly-Ex/123/423/xist/231512----___" does not exist.'
              })

              assertEquals(
                await ClassMain.API.fs.exists({
                  pathFiles: [
                    '/tmp/DOES-not-rewaly-Ex/123/423/xist/231512----___',
                  ],
                  thrownOnNotExist: false,
                }),
                [
                  {
                    exists: false,
                    pathFile:
                      '/tmp/DOES-not-rewaly-Ex/123/423/xist/231512----___',
                  },
                ]
              )
            },
          })
        })

        group('list', () => {
          test({
            name: 'works',
            async fn() {
              const results = await ClassMain.API.fs.list({
                pathDir: Common.path.utils.join(
                  Common.path.dir.fixtures,
                  'shell-utilities'
                ),
              })

              ;[
                results.dir.array,
                Object.keys(results.dir.object),
                results.file.array,
                Object.keys(results.file.object),
                results.symlink.array,
                Object.keys(results.symlink.object),
              ].forEach((what) => {
                assertEquals(what.length, 3)
              })
            },
          })

          test({
            name: 'option recursive',
            async fn() {
              const results = await ClassMain.API.fs.list({
                pathDir: Common.path.utils.join(
                  Common.path.dir.fixtures,
                  'shell-utilities'
                ),
                recursive: true,
                onRecurse({ dirEntry }) {
                  if (dirEntry.name === 'file.txt') {
                    return {
                      break: true,
                    }
                  }
                },
              })

              assertEquals(results.dir.array.length, 0)
              assertEquals(Object.keys(results.dir.object).length, 0)
              assertEquals(results.file.array.length, 1)
              assertEquals(Object.keys(results.file.object).length, 1)
              assertEquals(results.symlink.array.length, 1)
              assertEquals(Object.keys(results.symlink.object).length, 1)
            },
          })
        })
      })

      group('systemctl', () => {
        group('show', () => {
          group('success', () => {
            test({
              name: 'works',
              async fn() {
                const results = await ClassMain.API.systemd.show({
                  nameUnits: ['Hello-hey-hopp', 'systemd-networkd.service'],
                })

                results.forEach((systemShowResult) => {
                  assertEquals(Object.keys(systemShowResult).length > 1, true)
                })
              },
            })
          })
        })
      })
      group('user', () => {
        group('getters', () => {
          group('user', () => {
            test({
              name: 'works',
              async fn() {
                assertEquals(await ClassMain.API.user.getters.user(), {
                  userID: 1000,
                  userName: 'admin',
                })
              },
            })
          })
        })
      })

      group('os', () => {
        group('getters', () => {
          test({
            name: 'hostname',
            async fn() {
              assertEquals(
                (await (await ClassMain.API.os.getters.hostname()).length) > 0,
                true
              )
            },
          })
        })
      })
    })
  })
})
