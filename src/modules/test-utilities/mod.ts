// deno-lint-ignore-file no-explicit-any no-empty

import * as mock from 'https://deno.land/x/mock@0.15.2/mod.ts'
import { join } from 'https://deno.land/std@0.152.0/path/mod.ts'
import { generate as generateUUIDV5 } from 'https://deno.land/std@0.152.0/uuid/v5.ts'
import tempDirectory from 'https://deno.land/x/temp_dir@v1.0.0/mod.ts'
import { delay } from 'https://deno.land/x/delay@v0.2.0/mod.ts'

import { fileHandler } from '../singletons/file-handler.ts'
import { ObjectFreezeRecursive } from '../object-freeze-recursive/mod.ts'
import { bindAllFunctionsToObject } from '../bind/mod.ts'
import { ld } from '../lodash/mod.ts'
import { clone } from '../clone/mod.ts'
import { IGenericClass, TGenericObject } from '../../model/mod.ts'
import { DataTypes } from '../data-types/mod.ts'

const dirCurrent = new URL('.', import.meta.url).pathname.slice(0, -1)
const dirRootScriptEngine = join(dirCurrent, '..')
const rootScriptEngineTests = join(dirRootScriptEngine, '__tests__')

export class TestUtilities<
  TConstructorOptions extends {
    readonly getComponent: (...args: any) => any
  }
> {
  static CONSTANTS = ObjectFreezeRecursive.deepFreeze({
    relativePathChecks: ['..', './'],
  })

  static instances = {
    textDecoder: new TextDecoder(),
  }

  static paths = {
    dir: {
      rootScriptEngine: dirRootScriptEngine,
      rootScriptEngineTests,
      rootScriptEngineTestsTmp: join(rootScriptEngineTests, 'tmp'),
    },
  }

  static getters = {
    async deferredPromise<
      T1 extends {
        readonly afterDelay: () => ReturnType<T1['afterDelay']>
        readonly timeout?: number
      }
    >({ afterDelay, timeout = 0 }: T1) {
      await delay(timeout)
      return afterDelay()
    },
  }

  static utils = {
    delay,
    mock,
    generateUUIDV5,

    executeAndIgnoreErrors({ fns }: { readonly fns: Array<() => any> }) {
      return fns.reduce((acc, fn) => {
        try {
          acc.push(fn())
        } catch {}

        return acc
      }, [] as Array<any>)
    },

    // @TODO type this if used externally standalone following the getters.component and getters.instance
    extendObjectProperties<
      T1 extends {
        readonly objectExtended: T1['objectExtended'] & TGenericObject
        readonly objectSource: T1['objectSource'] & TGenericObject
        readonly mergeWithKeys?: TGenericObject<
          string | number | symbol,
          boolean
        >
        readonly targetToExtend: T1['targetToExtend'] & TGenericObject
      }
    >({
      objectExtended,
      objectSource,
      mergeWithKeys = {},
      targetToExtend,
    }: T1) {
      Object.entries(Object.getOwnPropertyDescriptors(objectExtended)).forEach(
        ([keyProperty, descriptor]) => {
          if (descriptor) {
            if (descriptor.get || descriptor.set) {
              descriptor.value

              return Reflect.defineProperty(
                targetToExtend,
                keyProperty,
                descriptor
              )
            }

            const descriptorOriginalModule = mergeWithKeys[keyProperty]
              ? Reflect.getOwnPropertyDescriptor(objectSource, keyProperty)
              : undefined

            Reflect.defineProperty(targetToExtend, keyProperty, {
              ...descriptor,
              value: descriptorOriginalModule?.value
                ? ld.merge(
                    descriptor.value,
                    ld.cloneDeep(descriptorOriginalModule!.value)
                  )
                : descriptor.value,
            })
          }
        }
      )

      return {
        objectExtended,
        objectSource,
        mergeWithKeys,
        targetToExtend,
      }
    },

    async generateTempFilePath<
      T1 extends {
        readonly data: Uint8Array
        readonly namespace?: string
      }
    >(x?: T1) {
      return join(
        tempDirectory,
        `${TestUtilities.name}_` +
          (await generateUUIDV5(
            x?.namespace || crypto.randomUUID(),
            x?.data || DataTypes.Uint8Array.fromString(TestUtilities.name)
          ))
      )
    },

    async runDeno({
      argsCLI,
      onOutputs,
    }: {
      readonly argsCLI: Array<string>
      readonly onOutputs: (x: {
        readonly process: Deno.Process
        readonly status: Deno.ProcessStatus
        readonly output: Uint8Array
        readonly outputError: Uint8Array
        readonly outputResults: string
        readonly outputResultsError: string
      }) => void | Promise<void>
    }) {
      const process = Deno.run({
        cmd: ['deno', 'run', ...argsCLI],
        stdout: 'piped',
        stderr: 'piped',
      })

      const [output, outputError] = await Promise.all([
        process.output(),
        process.stderrOutput(),
      ])
      const outputResults = TestUtilities.instances.textDecoder.decode(output)
      const outputResultsError =
        TestUtilities.instances.textDecoder.decode(outputError)

      try {
        await onOutputs({
          process,
          status: await process.status(),
          output,
          outputError,
          outputResults,
          outputResultsError,
        })
      } finally {
        process.close()
      }
    },

    async executeAndClean<
      TFnExecute extends (x: {
        readonly fileHandler: typeof fileHandler
        readonly generateTempFilePath: <
          T1 extends {
            readonly data: Uint8Array
            readonly namespace?: string
          }
        >(
          x?: T1
        ) => Promise<string>
        readonly generateUUIDV5: typeof generateUUIDV5
        readonly state: {
          readonly filesToRemove: Set<string>
        }
      }) => any | Promise<(x: { readonly filesToRemove: Set<string> }) => any>
    >(fnExecute: TFnExecute): Promise<ReturnType<TFnExecute>> {
      const state = {
        filesToRemove: new Set<string>(),
      }

      const cleanup = async () => {
        await Promise.all(
          Array.from(state.filesToRemove).map((x) => Deno.remove(x))
        )

        state.filesToRemove.clear()
      }

      try {
        const returned = await fnExecute(
          ObjectFreezeRecursive.deepFreeze({
            fileHandler,
            async generateTempFilePath(x) {
              const returnedPathFile =
                await TestUtilities.utils.generateTempFilePath(x)
              state.filesToRemove.add(returnedPathFile)
              return returnedPathFile
            },
            generateUUIDV5,
            state,
          })
        )

        return returned
      } finally {
        await cleanup()
      }
    },
  }

  userOptions: {
    getComponent: TConstructorOptions['getComponent']
  }

  constructor({ getComponent }: TConstructorOptions) {
    this.userOptions = {
      getComponent,
    }
  }

  getters = {
    /**
     *
     * @param objectMocks which will contain keys which will be add/override to the a clone of the imported module
     * }
     */
    component: async <
      T1 extends {
        readonly staticMocks?: TGenericObject
        readonly staticMergeWithKeys?: TGenericObject
        readonly withComponentPayload?: (x: {
          readonly OriginalModule: TComponent
          readonly NewModule: TOptionalComponentWithMocks
          readonly newModule: TOptionalComponentWithMocks
          readonly staticMocks: TGenericObject
          readonly staticMergeWithKeys: TGenericObject
          readonly utils: {
            readonly bindAllFunctionsToObject: typeof bindAllFunctionsToObject
            readonly clone: typeof clone
            readonly ld: typeof ld
          }
        }) => any
      },
      TComponent extends ReturnType<TConstructorOptions['getComponent']>,
      TOptionalComponentWithMocks extends T1['staticMocks'] extends TGenericObject
        ? T1['staticMocks'] & TComponent
        : TComponent
    >(
      options?: T1
    ): Promise<{
      readonly OriginalModule: TComponent
      readonly NewModule: TOptionalComponentWithMocks
      readonly newModule: TOptionalComponentWithMocks
      readonly staticMocks: T1['staticMocks']
      readonly staticMergeWithKeys: T1['staticMergeWithKeys']
      readonly withComponentPayloadResults: T1['withComponentPayload'] extends (
        ...args: any
      ) => any
        ? ReturnType<T1['withComponentPayload']>
        : any
    }> => {
      const {
        staticMocks = {},
        staticMergeWithKeys = {},
        withComponentPayload = () => undefined,
      } = { ...options }
      const OriginalModule = (await this.userOptions.getComponent({
        join,
      })) as TComponent
      const NewModule = clone(OriginalModule) as TOptionalComponentWithMocks

      const getReturned = async () => {
        return {
          OriginalModule: OriginalModule,
          NewModule: NewModule,
          newModule: NewModule,
          staticMocks,
          staticMergeWithKeys,
          withComponentPayloadResults: await withComponentPayload({
            OriginalModule: OriginalModule,
            NewModule: NewModule,
            newModule: NewModule,
            staticMocks,
            staticMergeWithKeys,
            utils: {
              bindAllFunctionsToObject,
              ld,
              clone,
            },
          }),
        }
      }

      if (!Object.keys(staticMocks).length) {
        return getReturned()
      }

      TestUtilities.utils.extendObjectProperties({
        objectExtended: staticMocks,
        objectSource: OriginalModule,
        mergeWithKeys: staticMergeWithKeys,
        targetToExtend: NewModule,
      })

      return getReturned()
    },

    instance: async <
      T1 extends {
        readonly argsInstance?: TComponent extends IGenericClass
          ? ConstructorParameters<TComponent>
          : undefined

        readonly instanceMocks?: TGenericObject

        readonly instanceMergeWithKeys?: TGenericObject

        readonly staticMocks?: TGenericObject

        readonly staticMergeWithKeys?: TGenericObject

        readonly withComponentPayload?: (x: {
          readonly OriginalModule: TComponent
          readonly NewModule: TOptionalComponentWithMocks
          readonly newModule: TOptionalComponentWithMocks
          readonly staticMocks: TGenericObject
          readonly staticMergeWithKeys: TGenericObject
          readonly utils: {
            readonly bindAllFunctionsToObject: typeof bindAllFunctionsToObject
            readonly clone: typeof clone
            readonly ld: typeof ld
          }
        }) => any

        readonly withInstancePayload?: (x: {
          readonly OriginalModule: TComponent
          readonly NewModule: TOptionalComponentWithMocks
          readonly newModule: TOptionalComponentWithMocks
          readonly instance: TInstanceWithMocks
          readonly instanceMocks: TGenericObject
          readonly instanceMergeWithKeys: TGenericObject
          readonly staticMocks: TGenericObject
          readonly staticMergeWithKeys: TGenericObject
          readonly utils: {
            readonly bindAllFunctionsToObject: typeof bindAllFunctionsToObject
            readonly clone: typeof clone
            readonly ld: typeof ld
          }
        }) => any
      },
      TComponent extends ReturnType<TConstructorOptions['getComponent']>,
      TOptionalComponentWithMocks extends T1['staticMocks'] extends TGenericObject
        ? T1['staticMocks'] & TComponent
        : TComponent,
      TInstanceWithMocks extends (TComponent extends IGenericClass
        ? InstanceType<TComponent>
        : TGenericObject) &
        T1['instanceMocks']
    >(
      options?: T1
    ): Promise<{
      readonly OriginalModule: TComponent
      readonly NewModule: TOptionalComponentWithMocks
      readonly newModule: TOptionalComponentWithMocks
      readonly staticMocks: T1['staticMocks']
      readonly staticMergeWithKeys: T1['staticMergeWithKeys']
      readonly withComponentPayloadResults: T1['withComponentPayload'] extends (
        ...args: any
      ) => any
        ? ReturnType<T1['withComponentPayload']>
        : any
      readonly withInstancePayloadResults: T1['withInstancePayload'] extends (
        ...args: any
      ) => any
        ? ReturnType<T1['withInstancePayload']>
        : any
      readonly instance: TInstanceWithMocks
      readonly instanceMocks: T1['instanceMocks']
      readonly instanceMergeWithKeys: T1['instanceMergeWithKeys']
    }> => {
      const {
        argsInstance,
        instanceMocks = {},
        instanceMergeWithKeys = {},
        staticMocks = {},
        staticMergeWithKeys = {},
        withComponentPayload,
        withInstancePayload = () => undefined,
      } = { ...options }
      const payloadGetterComponent = await this.getters.component({
        staticMocks,
        staticMergeWithKeys,
        withComponentPayload,
      })

      const instance: TInstanceWithMocks = new payloadGetterComponent.NewModule(
        ...(Array.isArray(argsInstance) ? argsInstance : [])
      )

      if (instanceMocks) {
        TestUtilities.utils.extendObjectProperties({
          objectExtended: instanceMocks,
          objectSource: instance,
          mergeWithKeys: instanceMergeWithKeys,
          targetToExtend: instance,
        })
      }

      return {
        ...payloadGetterComponent,
        instanceMocks,
        instanceMergeWithKeys,
        instance,
        withInstancePayloadResults: await withInstancePayload({
          OriginalModule: payloadGetterComponent.OriginalModule,
          NewModule: payloadGetterComponent.NewModule,
          newModule: payloadGetterComponent.newModule,
          staticMocks,
          staticMergeWithKeys,
          instance: instance,
          instanceMocks,
          instanceMergeWithKeys,
          utils: {
            bindAllFunctionsToObject,
            ld,
            clone,
          },
        }),
      }
    },
  }
}
