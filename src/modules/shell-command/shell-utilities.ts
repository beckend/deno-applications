import * as ini from 'https://deno.land/x/ini@v2.1.0/mod.ts'
import { EOL } from 'https://deno.land/std@0.152.0/fs/eol.ts'

import { Exec, IOutputMode } from '../exec/mod.ts'
import { TGenericObject } from '../../model/mod.ts'

export { Exec, IOutputMode }

export interface IOptionsSudo {
  readonly sudo?: boolean
}

export class ShellUtilities {
  static path = {
    dir: {
      userHome: Deno.env.get('HOME'),
    },
  }

  static getters = {
    sudo<T1 extends IOptionsSudo>({ sudo }: T1) {
      return sudo ? 'sudo ' : ''
    },
  }

  static API = {
    checks: {
      async requireRoot() {
        if ((await ShellUtilities.API.user.getters.user()).userID !== 0) {
          throw new Error('root is required')
        }
      },

      async requireNonRoot() {
        if ((await ShellUtilities.API.user.getters.user()).userID === 0) {
          throw new Error('root is not allowed')
        }
      },
    },

    fs: {
      exists<
        T1 extends {
          readonly pathFiles: Array<string>
          readonly thrownOnNotExist?: boolean
        }
      >({ pathFiles, thrownOnNotExist = true }: T1) {
        return Promise.all(
          pathFiles.reduce(
            (acc, pathFile) => {
              acc.push(
                Deno.lstat(pathFile)
                  .then((pathInfo) => ({
                    exists: true,
                    pathFile,
                    pathInfo,
                  }))
                  .catch(() => {
                    if (thrownOnNotExist) {
                      throw new Error(`"${pathFile}" does not exist.`)
                    } else {
                      return {
                        exists: false,
                        pathFile,
                      }
                    }
                  })
              )

              return acc
            },
            [] as Array<
              Promise<{
                readonly exists: boolean
                readonly pathFile: string
                readonly pathInfo?: Deno.FileInfo
              }>
            >
          )
        )
      },

      list: async <
        T1 extends {
          readonly onRecurse?: <
            TOnRecurse extends {
              readonly dirEntry: Deno.DirEntry
              readonly pathDir: string
              readonly pathDirSub: string
              readonly returned: {
                readonly dir: {
                  readonly array: Array<string>
                  object: {
                    [keyPathDir: string]: string
                  }
                }

                readonly file: {
                  readonly array: Array<string>
                  object: {
                    [keyPathDir: string]: string
                  }
                }

                readonly symlink: {
                  readonly array: Array<string>
                  object: {
                    [keyPathDir: string]: string
                  }
                }
              }
            }
          >(
            x: TOnRecurse
          ) =>
            | undefined
            | void
            | {
                readonly break: boolean
              }
            | Promise<
                | undefined
                | void
                | {
                    readonly break: boolean
                  }
              >
          readonly pathDir: string
          readonly recursive?: boolean

          readonly returned?: {
            readonly dir: {
              readonly array: Array<string>
              object: {
                [keyPathDir: string]: string
              }
            }

            readonly file: {
              readonly array: Array<string>
              object: {
                [keyPathDir: string]: string
              }
            }

            readonly symlink: {
              readonly array: Array<string>
              object: {
                [keyPathDir: string]: string
              }
            }
          }
        }
      >(
        options: T1
      ) => {
        const {
          onRecurse,
          pathDir,
          recursive = true,

          returned = {
            dir: {
              array: [],
              object: {},
            },

            file: {
              array: [],
              object: {},
            },

            symlink: {
              array: [],
              object: {},
            },
          },
        } = options

        for await (const dirEntry of Deno.readDir(pathDir)) {
          const pathDirSub = `${pathDir}/${dirEntry.name}`

          let typeEntry = 'file' as keyof typeof returned

          if (dirEntry.isDirectory) {
            typeEntry = 'dir'
          } else if (dirEntry.isFile) {
            typeEntry = 'file'
          } else if (dirEntry.isSymlink) {
            typeEntry = 'symlink'
          }

          returned[typeEntry].array.push(pathDirSub)
          returned[typeEntry].object[pathDirSub] = pathDirSub

          if (recursive && dirEntry.isDirectory) {
            await ShellUtilities.API.fs.list({
              ...options,
              pathDir: pathDirSub,
              returned,
            })
          }

          const resultsRecurse =
            onRecurse &&
            (await onRecurse({
              dirEntry,
              pathDir,
              pathDirSub,
              returned,
            }))

          if (resultsRecurse && resultsRecurse.break) {
            break
          }
        }

        return returned
      },
    },

    systemd: {
      async show<
        T1 extends IOptionsSudo & {
          readonly nameUnits: Array<string>
        }
      >({ nameUnits, sudo = false }: T1) {
        const results = await Exec.API.exec({
          getCommand: () =>
            `${ShellUtilities.getters.sudo({
              sudo,
            })}systemctl show ${nameUnits.join(' ')}`,
        })

        return results.outputs.stdOut
          .split(EOL.LF.repeat(2))
          .map(ini.parse) as Array<TGenericObject<string, string | number>>
      },
    },

    user: {
      getters: {
        async user() {
          const { envAdded } = await Exec.API.execMulti({
            getCommands: () => [
              {
                ID: '__EXEC_USER_NUMBER',
                getCommand: () => 'id -u',
              },
              {
                ID: '__EXEC_USER_NAME',
                getCommand: () => 'id -un ${__EXEC_USER_NUMBER}',
              },
            ],
          })

          return {
            userID: +envAdded.__EXEC_USER_NUMBER as number,
            userName: envAdded.__EXEC_USER_NAME,
          }
        },
      },
    },

    os: {
      getters: {
        async hostname() {
          const {
            outputs: { stdOut },
          } = await Exec.API.exec({
            getCommand: () => 'uname --n',
          })

          return stdOut
        },
      },
    },
  }
}
