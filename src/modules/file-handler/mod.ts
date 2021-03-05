// deno-lint-ignore-file no-explicit-any
import { EOL } from 'https://deno.land/std@0.152.0/fs/eol.ts'
import {
  parse as yamlParse,
  stringify as yamlStringify,
} from 'https://deno.land/std@0.152.0/encoding/yaml.ts'
import { ensureDir as fsEnsureDir } from 'https://deno.land/std@0.152.0/fs/mod.ts'
import {
  copy,
  readAll,
  readerFromStreamReader,
} from 'https://deno.land/std@0.152.0/streams/conversion.ts'
import {
  dirname,
  isAbsolute,
  join,
  resolve as pathResolve,
} from 'https://deno.land/std@0.152.0/path/mod.ts'
import { parse as tomlParse } from 'https://deno.land/std@0.152.0/encoding/toml.ts'

import { DependencyHandler } from '../dependency-handler/mod.ts'
import { CustomError } from '../custom-error/mod.ts'
import { TGenericObject, TOptionalPromise } from '../../model/mod.ts'

export type TFileTypeLoaderReturn = Promise<TGenericObject>

export class ErrorInvariantLoadModule extends CustomError {
  constructor(message: string) {
    super(message)
  }
}

export class FileHandler {
  static constants = {
    dummyURL: new URL('https://nope.com'),
  }

  static instances = {
    decoderText: new TextDecoder('utf-8'),
  }

  static utils = {
    sanitizePath<T1 extends { readonly path: string }>({
      path: pathTarget,
    }: T1) {
      if (pathTarget.startsWith('~')) {
        return pathResolve(pathTarget.replace('~', Deno.env.get('HOME') || '~'))
      }

      return pathResolve(pathTarget)
    },

    onFileContentsLineByLine<
      T1 extends {
        contents: string
        onContentsLine: Array<(line: string) => string | void>
      }
    >({ contents, onContentsLine }: T1) {
      return contents.split(EOL.LF).reduce((acc, line) => {
        const result = onContentsLine.reduce((lineCurrent, fn) => {
          const result = fn(lineCurrent)

          if (typeof result === 'string') {
            return `${result}${EOL.LF}`
          }

          return lineCurrent
        }, line)

        acc += `${result}${EOL.LF}`

        return acc
      }, '')
    },
  }

  static getters = {
    errorInvariantLoadModule<T1 extends { readonly IDLoader: string }>({
      IDLoader,
    }: T1) {
      return new ErrorInvariantLoadModule(
        `${FileHandler.name}.loadersModule.${IDLoader} - invariant, contentFile or pathFile is required as arguments.`
      )
    },

    yaml: {
      toArrayOfObjects<
        T1 extends {
          readonly text: string
        }
      >({ text }: T1) {
        return text.split('---').reduce((acc, str) => {
          if (str) {
            acc.push(yamlParse(str) as Record<string, any>)
          }

          return acc
        }, [] as Array<Record<string, any>>)
      },

      toYaml<
        T1 extends {
          readonly dataArray: Array<Record<string, any>>
        }
      >({ dataArray }: T1) {
        const indexMax = dataArray.length - 1

        return dataArray.reduce((acc, dataObject, index) => {
          acc += yamlStringify(dataObject)

          if (index < indexMax) {
            acc += `---${EOL.LF}`
          }

          return acc
        }, '')
      },
    },

    URLTypes: {
      github<
        T1 extends {
          readonly URL: string | URL
        }
      >(options: T1) {
        const isURLInstanceOfURL = options.URL instanceof URL
        const newURL = isURLInstanceOfURL
          ? (options.URL as URL)
          : new URL(options.URL as string)

        if (newURL.origin === 'https://github.com') {
          return {
            URL: new URL(
              newURL.href
                .replace(
                  'https://github.com',
                  'https://raw.githubusercontent.com'
                )
                .replace('/blob/', '/')
            ),
          }
        }

        return {
          URL: newURL,
        }
      },
    },

    URL<
      T1 extends {
        readonly URL: string | URL
      }
    >(options: T1) {
      return Object.values(FileHandler.getters.URLTypes).reduce(
        (_acc, fn) => {
          return fn({ URL: options.URL })
        },
        {
          URL: FileHandler.constants.dummyURL,
        }
      )
    },
  }

  DH = new DependencyHandler({
    dependencies: {
      Deno,

      Uint8Array: {
        readAll,
      },

      fs: {
        ensureDir: fsEnsureDir,
      },

      stream: {
        copy,
      },
    },
  })

  API = {
    createFileDirectory: async <
      T1 extends {
        readonly createDirectory: boolean
        readonly path: string
      }
    >({
      createDirectory,
      path: pathTarget,
    }: T1) => {
      const fileDir = dirname(
        FileHandler.utils.sanitizePath({ path: pathTarget })
      )
      const fileDirExists = await this.DH.dependencies.Deno.lstat(
        fileDir
      ).catch(() => false)

      if (!fileDirExists) {
        if (createDirectory) {
          await this.DH.dependencies.fs.ensureDir(fileDir)
        } else {
          throw new Error(
            `directory "${fileDir}" does not exist and option to create it is not true.`
          )
        }
      }
    },

    downloadFile: <
      T1 extends {
        readonly createDirectory?: boolean
        readonly overwriteFile?: boolean
        readonly pathFile?: string
        readonly request: Parameters<typeof fetch>[0]
        readonly requestOptions?: Parameters<typeof fetch>[1]
        readonly returnContent?: boolean
        readonly transformPathFile?: <
          T1 extends {
            readonly response: Response
          }
        >(
          x: T1
        ) => TOptionalPromise<string>
        readonly transformURL?: boolean
      }
    >({
      createDirectory = true,
      overwriteFile = true,
      pathFile,
      request,
      requestOptions: requestOptionsInput,
      returnContent,
      transformPathFile,
      transformURL = true,
    }: T1): T1['returnContent'] extends true
      ? {
          readonly fetch: () => Promise<{
            readonly contentFile: string
            readonly pathFile: string
            readonly response: Response
          }>
          readonly requestOptions: T1['requestOptions'] & {
            readonly signal: AbortSignal
          }
        }
      : {
          readonly fetch: () => Promise<{
            readonly contentFile: undefined
            readonly pathFile: string
            readonly response: Response
          }>
          readonly requestOptions: T1['requestOptions'] & {
            readonly signal: AbortSignal
          }
        } => {
      if (
        ![returnContent, transformPathFile, pathFile].some(
          (x) => x !== undefined
        )
      ) {
        throw new Error(
          'Either combinations of argument pathFile/transformPathFile/returnContent is required.'
        )
      }

      const requestOptions = {
        ...requestOptionsInput,
        signal:
          requestOptionsInput && requestOptionsInput.signal
            ? requestOptionsInput.signal
            : new AbortController().signal,
      }

      const returned = {
        fetch: async () => {
          const response = await fetch(
            transformURL
              ? request instanceof Request
                ? request
                : FileHandler.getters.URL({ URL: request }).URL
              : request,
            requestOptions
          )
          const reader = readerFromStreamReader(response.body!.getReader())

          if (pathFile || transformPathFile) {
            const pathFileSanitized = FileHandler.utils.sanitizePath({
              path: transformPathFile
                ? await transformPathFile({
                    response,
                  })
                : pathFile!,
            })
            await this.API.createFileDirectory({
              createDirectory,
              path: pathFileSanitized,
            })

            const file = await this.DH.dependencies.Deno.open(
              pathFileSanitized,
              {
                create: true,
                truncate: overwriteFile,
                write: true,
              }
            )

            try {
              await this.DH.dependencies.stream.copy(reader, file)
            } finally {
              file.close()
            }

            return {
              contentFile: returnContent
                ? await this.DH.dependencies.Deno.readTextFile(
                    pathFileSanitized
                  )
                : undefined,
              pathFile: pathFileSanitized,
              response,
            }
          } else {
            return {
              contentFile: FileHandler.instances.decoderText.decode(
                await this.DH.dependencies.Uint8Array.readAll(await reader)
              ),
              pathFile,
              response,
            }
          }
        },
        requestOptions,
      }

      return returned as any
    },

    readFileToString: async <T1 extends { readonly pathFile: string }>({
      pathFile,
    }: T1) => {
      return new TextDecoder('utf-8').decode(
        await this.DH.dependencies.Deno.readFile(
          FileHandler.utils.sanitizePath({
            path: pathFile,
          })
        )
      )
    },

    modifyFile: async <
      T1 extends {
        readonly onContents: (x: {
          readonly contents: string
          readonly onFileContentsLineByLine: typeof FileHandler['utils']['onFileContentsLineByLine']
        }) => Promise<string> | string
        readonly pathFile: string
      }
    >({
      pathFile,
      onContents,
    }: T1) => {
      const pathFileSanitized = FileHandler.utils.sanitizePath({
        path: pathFile,
      })
      const contentOriginal = await this.API.readFileToString({
        pathFile: pathFileSanitized,
      })
      const contentNew = await onContents({
        contents: contentOriginal,
        onFileContentsLineByLine: FileHandler.utils.onFileContentsLineByLine,
      })

      if (contentOriginal === contentNew) {
        return
      }

      return this.API.writeFile({
        contentFile: contentNew,
        pathFile: pathFileSanitized,
        overwriteFile: true,
      })
    },

    writeFile: async <
      T1 extends {
        readonly contentFile?: string | Promise<string>
        readonly createDirectory?: boolean
        readonly overwriteFile?: boolean
        readonly pathFile: string
        readonly readerSource?: Deno.Reader | Promise<Deno.Reader>
        readonly returnContent?: boolean
        readonly chown?: {
          readonly uid: number
          readonly gid: number
        }
        readonly chmod?: {
          mode: number
        }
      }
    >({
      contentFile,
      createDirectory = true,
      overwriteFile = true,
      pathFile,
      readerSource,
      returnContent = false,
      chown,
      chmod,
    }: T1) => {
      if (!contentFile && !readerSource) {
        throw new Error(
          'Invariant, need to supply either contentFile or readerSource argument.'
        )
      }

      const [pathExists, contentBuffer] = await Promise.all([
        this.DH.dependencies.Deno.lstat(pathFile).catch(() => false),

        returnContent && readerSource
          ? this.DH.dependencies.Uint8Array.readAll(await readerSource)
          : Promise.resolve(undefined),
      ])
      const shouldWritePath = overwriteFile || (!overwriteFile && !pathExists)
      const shouldChown = Boolean(chown)
      const shouldChmod = Boolean(chmod)
      const shouldChangeFileProperties = shouldChown || shouldChmod
      const pathFileSanitized = FileHandler.utils.sanitizePath({
        path: pathFile,
      })

      if (shouldWritePath) {
        await this.API.createFileDirectory({
          createDirectory,
          path: pathFileSanitized,
        })

        if (contentFile) {
          await this.DH.dependencies.Deno.writeTextFile(
            pathFileSanitized,
            await contentFile
          )
        } else if (readerSource) {
          if (returnContent && contentBuffer) {
            await this.DH.dependencies.Deno.writeFile(
              pathFileSanitized,
              contentBuffer
            )
          } else {
            const fileNew = await this.DH.dependencies.Deno.open(
              pathFileSanitized,
              {
                create: true,
                truncate: overwriteFile,
                write: true,
              }
            )

            try {
              await this.DH.dependencies.stream.copy(
                await readerSource,

                fileNew
              )
            } finally {
              fileNew.close()
            }
          }
        }
      }

      if (shouldChangeFileProperties) {
        const promises: Array<Promise<any>> = []

        if (chown) {
          promises.push(
            this.DH.dependencies.Deno.chown(
              pathFileSanitized,
              chown.uid,
              chown.gid
            )
          )
        }

        if (chmod) {
          promises.push(
            this.DH.dependencies.Deno.chmod(pathFileSanitized, chmod.mode)
          )
        }

        await Promise.all(promises)
      }

      return {
        contentFile: returnContent
          ? (await contentFile) ||
            FileHandler.instances.decoderText.decode(contentBuffer)
          : undefined,
        pathFile: pathFileSanitized,
        readerSource: await readerSource,
        appliedChmod: shouldChmod,
        appliedChown: shouldChown,
        wroteFile: shouldWritePath,
      }
    },

    symlink: async <
      T1 extends {
        readonly checkExistSource?: boolean
        readonly overwriteDestination?: boolean
        readonly pathDestination: string
        readonly pathSource: string
      }
    >({
      checkExistSource = false,
      overwriteDestination = false,
      pathSource,
      pathDestination,
    }: T1) => {
      const [pathDestinationExists] = await Promise.all(
        [
          this.DH.dependencies.Deno.open(pathDestination, { read: true })
            .then(() => true)
            .catch(() => false),

          checkExistSource &&
            this.DH.dependencies.Deno.open(pathSource, { read: true })
              .then(() => true)
              .catch((err) => {
                console.error(`path source: ${pathSource} cannot read`)
                throw err
              }),
        ].filter(Boolean)
      )

      if (!overwriteDestination && pathDestinationExists) {
        throw new Error(`path: ${pathDestination} exists, overwrite is false`)
      }

      if (pathDestinationExists) {
        await this.DH.dependencies.Deno.remove(pathDestination)
      }

      await this.DH.dependencies.Deno.symlink(pathSource, pathDestination)
    },

    walkRecursive: (options: {
      readonly onEntry: (x: {
        readonly entry: Deno.DirEntry
        readonly entryPath: string
      }) =>
        | Promise<{
            readonly break: boolean
          }>
        | {
            readonly break: boolean
          }
      readonly pathTarget: string
    }) => {
      const hasTraversed: TGenericObject = {}

      const walkDir = async (target: string) => {
        if (hasTraversed[target]) {
          return
        }

        for await (const entry of Deno.readDir(target)) {
          hasTraversed[target] = true

          const entryPath = `${target}/${entry.name}`

          if ((await options.onEntry({ entry, entryPath })).break) {
            break
          }

          if (entry.isDirectory) {
            await walkDir(entryPath)
          } else if (entry.isSymlink) {
            const pathSymlinkResolved = await Deno.readLink(entryPath)
            const pathAbsolute = isAbsolute(pathSymlinkResolved)
              ? pathSymlinkResolved
              : join(target, pathSymlinkResolved)

            if ((await Deno.stat(pathAbsolute)).isDirectory) {
              await walkDir(pathAbsolute)
            }
          }
        }
      }

      return walkDir(
        FileHandler.utils.sanitizePath({
          path: options.pathTarget,
        })
      )
    },
  }

  loadersModule = {
    json: async <
      T1 extends {
        readonly contentFile?: string
        readonly pathFile?: string
      }
    >({
      contentFile,
      pathFile,
    }: T1): TFileTypeLoaderReturn => {
      if (!contentFile && !pathFile) {
        return Promise.reject(
          FileHandler.getters.errorInvariantLoadModule({ IDLoader: 'json' })
        )
      }

      return JSON.parse(
        pathFile ? await this.API.readFileToString({ pathFile }) : contentFile!
      )
    },

    yaml: async <
      T1 extends {
        readonly contentFile?: string
        readonly pathFile?: string
      }
    >({
      contentFile,
      pathFile,
    }: T1): TFileTypeLoaderReturn => {
      if (!contentFile && !pathFile) {
        return Promise.reject(
          FileHandler.getters.errorInvariantLoadModule({ IDLoader: 'yaml' })
        )
      }

      return yamlParse(
        pathFile ? await this.API.readFileToString({ pathFile }) : contentFile!
      ) as any
    },

    toml: async <
      T1 extends {
        readonly contentFile?: string
        readonly pathFile?: string
      }
    >({
      contentFile,
      pathFile,
    }: T1): TFileTypeLoaderReturn => {
      if (!contentFile && !pathFile) {
        return Promise.reject(
          FileHandler.getters.errorInvariantLoadModule({ IDLoader: 'yaml' })
        )
      }

      return tomlParse(
        pathFile ? await this.API.readFileToString({ pathFile }) : contentFile!
      ) as any
    },

    ts: <
      T1 extends {
        readonly contentFile?: string
        readonly pathFile?: string
      }
    >({
      contentFile,
      pathFile,
    }: T1): TFileTypeLoaderReturn => {
      if (pathFile) {
        return import(pathFile)
      }

      if (contentFile) {
        return import(`data:application/typescript;base64,${btoa(contentFile)}`)
      }

      return Promise.reject(
        FileHandler.getters.errorInvariantLoadModule({ IDLoader: 'ts' })
      )
    },
  }
}
