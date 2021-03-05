// deno-lint-ignore-file no-explicit-any
import { EOL } from 'https://deno.land/std@0.114.0/fs/eol.ts'
import { readerFromStreamReader } from 'https://deno.land/std@0.114.0/io/streams.ts'
import {
  parse as yamlParse,
  stringify as yamlStringify,
} from 'https://deno.land/std@0.114.0/encoding/yaml.ts'
import {
  ensureDir as fsEnsureDir,
  exists as fsExists,
} from 'https://deno.land/std@0.114.0/fs/mod.ts'
import {
  basename,
  extname,
  dirname,
  isAbsolute,
  join,
  resolve as pathResolve,
} from 'https://deno.land/std@0.114.0/path/mod.ts'
import { parse as tomlParse } from 'https://deno.land/std@0.114.0/encoding/toml.ts'
import PQueue from 'https://deno.land/x/p_queue@1.0.1/mod.ts'
import { move } from 'https://deno.land/std@0.114.0/fs/move.ts'
import { copy } from 'https://deno.land/std@0.114.0/streams/conversion.ts'

import { DependencyHandler } from '../dependency-handler/mod.ts'
import { CustomError } from '../custom-error/mod.ts'
import { TGenericObject } from '../../model/mod.ts'

export type TFileTypeLoaderReturn = Promise<TGenericObject>

export class ErrorInvariantLoadModule extends CustomError {
  constructor(message: string) {
    super(message)
  }
}

export class FileHandler {
  static defaults = {
    concurrency: 9,
    noop() {},
  }

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
        return pathResolve(pathTarget.replace('~', Deno.env.get('HOME') || ''))
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

      streams: {
        copy,
      },

      fs: {
        ensureDir: fsEnsureDir,
        exists: fsExists,
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
      const fileDirExists = await this.DH.dependencies.fs.exists(fileDir)

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
        readonly transformURL?: boolean
      }
    >({
      createDirectory = true,
      overwriteFile = true,
      pathFile,
      request,
      requestOptions: requestOptionsInput,
      returnContent,
      transformURL = true,
    }: T1): T1['returnContent'] extends true
      ? {
          readonly fetch: () => Promise<{ readonly contentFile: string }>
          readonly requestOptions: T1['requestOptions'] & {
            readonly signal: AbortSignal
          }
        }
      : {
          readonly fetch: () => Promise<{ readonly contentFile: undefined }>
          readonly requestOptions: T1['requestOptions'] & {
            readonly signal: AbortSignal
          }
        } => {
      if (!pathFile && !returnContent) {
        throw new Error(
          'Either combinations of argument pathFile/returnContent is required.'
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

          if (pathFile) {
            const pathFileSanitized = FileHandler.utils.sanitizePath({
              path: pathFile,
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
              await this.DH.dependencies.streams.copy(reader, file)
            } finally {
              file.close()
            }

            return {
              contentFile: returnContent
                ? await this.DH.dependencies.Deno.readTextFile(
                    pathFileSanitized
                  )
                : undefined,
            }
          } else {
            return {
              contentFile: FileHandler.instances.decoderText.decode(
                await this.DH.dependencies.Deno.readAll(await reader)
              ),
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
        fsExists(pathFile),

        returnContent && readerSource
          ? this.DH.dependencies.Deno.readAll(await readerSource)
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
              await this.DH.dependencies.streams.copy(
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

    renameDirectoryExtensions: async ({
      concurrency = FileHandler.defaults.concurrency,
      createDirectoryDestinationIfNotExist = false,
      extensionDestination,
      extensionSource,
      limitDepthDirectory,
      overwriteDestination = false,
      pathDirDestination: pathDirDestinationInput,
      pathDirSource: pathDirSourceInput,

      onEntryMove = FileHandler.defaults.noop,
    }: {
      readonly concurrency?: number
      readonly createDirectoryDestinationIfNotExist?: boolean
      readonly extensionDestination: string
      readonly extensionSource: string
      readonly limitDepthDirectory?: number
      readonly overwriteDestination?: boolean
      readonly pathDirDestination: string
      readonly pathDirSource: string

      readonly onEntryMove?: (x: {
        readonly entry: Deno.DirEntry
        readonly entryPath: string
        readonly pathFileDestination: string
        readonly promiseMove: ReturnType<typeof move>
      }) => void | Promise<void>
    }) => {
      const pathDirDestination = pathResolve(pathDirDestinationInput)
      const pathDirSource = pathResolve(pathDirSourceInput)

      if (createDirectoryDestinationIfNotExist) {
        await fsEnsureDir(pathDirDestination)
      }

      const state = {
        queueJobs: {
          IO: new PQueue({ concurrency }),
        },
      }

      await this.API.walkRecursive({
        limitDepthDirectory,
        onEntry: ({ entry, entryPath }) => {
          const nameFileExtension = extname(entry.name)

          if (entry.isFile && nameFileExtension === extensionSource) {
            state.queueJobs.IO.add(async () => {
              const nameFileDestination =
                basename(entry.name).replace(extname(entry.name), '') +
                extensionDestination
              const pathFileDestination = join(
                dirname(entryPath),
                nameFileDestination
              )

              const promiseMove = move(entryPath, pathFileDestination, {
                overwrite: overwriteDestination,
              })

              await onEntryMove({
                entry,
                entryPath,
                pathFileDestination,
                promiseMove,
              })

              return promiseMove
            })
          }

          return {
            break: false,
          }
        },
        pathTarget: pathDirSource,
      })

      return state.queueJobs.IO
    },

    walkRecursive: ({
      limitDepthDirectory = 0,
      onEntry,
      pathTarget,
    }: {
      readonly onEntry: (x: {
        readonly depthDirectory: number
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
      readonly limitDepthDirectory?: number
    }) => {
      const hasTraversed: TGenericObject = {}

      const walkDir = async (target: string, depth: number) => {
        if (limitDepthDirectory && depth > limitDepthDirectory) {
          return
        }
        if (hasTraversed[target]) {
          return
        }

        for await (const entry of Deno.readDir(target)) {
          hasTraversed[target] = true

          const entryPath = `${target}/${entry.name}`

          if (
            (await onEntry({ depthDirectory: depth, entry, entryPath })).break
          ) {
            break
          }

          if (entry.isDirectory) {
            await walkDir(entryPath, depth + 1)
          } else if (entry.isSymlink) {
            const pathSymlinkResolved = await Deno.readLink(entryPath)
            const pathAbsolute = isAbsolute(pathSymlinkResolved)
              ? pathSymlinkResolved
              : join(target, pathSymlinkResolved)

            if ((await Deno.stat(pathAbsolute)).isDirectory) {
              await walkDir(pathAbsolute, depth + 1)
            }
          }
        }
      }

      return walkDir(
        FileHandler.utils.sanitizePath({
          path: pathTarget,
        }),
        1
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
        throw FileHandler.getters.errorInvariantLoadModule({ IDLoader: 'json' })
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
        throw FileHandler.getters.errorInvariantLoadModule({ IDLoader: 'yaml' })
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
        throw FileHandler.getters.errorInvariantLoadModule({ IDLoader: 'yaml' })
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

      throw FileHandler.getters.errorInvariantLoadModule({ IDLoader: 'ts' })
    },
  }
}
