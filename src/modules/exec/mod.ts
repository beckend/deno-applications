// deno-lint-ignore-file no-explicit-any
import { shellEscapeTag } from '../shell-escape-tag/mod.ts'
import { DependencyHandler } from '../dependency-handler/mod.ts'
import { ClassArray } from '../array/mod.ts'
import { TAsyncReturnType, TOptionalPromise } from '../../model/mod.ts'

export enum IOutputMode {
  // no output, just run the command
  None = 'None',
  // dump the output to stdout and stderr
  StdOutErr = 'StdOutErr',
  // capture the output and return it
  Capture = 'Capture',
  // both dump and capture the output
  // Tee = 'Tee',
}

export interface IExecAPIExecBaseOptions {
  readonly modeOutput?: IOutputMode
  readonly optionsRun?: Partial<Parameters<typeof Deno.run>[0]>
  readonly throwOnCommandError?: boolean
  readonly trimOutputs?: boolean
  readonly withShell?: boolean
  readonly withEnv?: boolean
  readonly withShellOptions?: {
    readonly doLogin?: boolean
    readonly shellFullPath?: string
    readonly shellOptions?: string
  }
}

export interface IExecAPIExecOptions extends IExecAPIExecBaseOptions {
  readonly getCommand: <
    T1 extends {
      readonly shellEscapeTag: typeof shellEscapeTag
    }
  >(
    x: T1
  ) => TOptionalPromise<Array<string> | string>
}

export interface IExecAPIExecMultiReturnSingleObjectBase {
  readonly getCommand: <
    T1CommandOptions extends {
      readonly IDCommandCurrent: string
      readonly IDCommandPrevious: string
    }
  >(
    x: T1CommandOptions
  ) => TOptionalPromise<Array<string> | string>

  readonly onAfterCommand?: <
    T1 extends TAsyncReturnType<typeof Exec['API']['execMulti']>
  >(
    x: T1
  ) => TOptionalPromise<
    | {
        readonly break?: boolean
      }
    | undefined
    | void
  >

  readonly onBeforeCommand?: <
    T1 extends TAsyncReturnType<typeof Exec['API']['execMulti']>
  >(
    x: T1
  ) => TOptionalPromise<
    | {
        readonly continue?: boolean
        readonly break?: boolean
      }
    | undefined
    | void
  >

  readonly optionsExec?: IExecAPIExecOptions
}

export interface IExecAPIExecMultiReturnSingleObject
  extends IExecAPIExecMultiReturnSingleObjectBase {
  // this will used to be set the output to the env key as a value, so ID=value, example USERNAME=`${stdOutresultString}` when ID: 'USERNAME'
  readonly ID?: string
}

export interface IExecAPIExecMultiReturnSingleObjectReturned
  extends IExecAPIExecMultiReturnSingleObjectBase {
  readonly ID: string
}
export type TExecAPIExecMultiReturnSingle =
  | IExecAPIExecMultiReturnSingleObject
  | Array<string>
  | string

export type TArrayExecAPIExecMultiReturnSingle =
  Array<TExecAPIExecMultiReturnSingle>
export type TArrayExecAPIExecMultiReturnSingleReturn =
  TOptionalPromise<TArrayExecAPIExecMultiReturnSingle>

export interface IExecAPIExecMultiOptions extends IExecAPIExecBaseOptions {
  readonly getCommands: <
    T1 extends {
      readonly defaults: typeof Exec['defaults']
      readonly shellEscapeTag: typeof shellEscapeTag
    }
  >(
    x: T1
  ) => TArrayExecAPIExecMultiReturnSingleReturn
}

export class Exec {
  static DH = new DependencyHandler({
    dependencies: {
      Deno,
    },
  })

  static defaults = {
    optionsDenoRun: {
      stdout: 'piped',
      stderr: 'piped',
    } as Deno.RunOptions,

    optionsAPIExec: {
      modeOutput: IOutputMode.Capture,
      throwOnCommandError: true,
      trimOutputs: true,
      withEnv: true,
      withShell: false,
      withShellOptions: {
        doLogin: true,
        shellFullPath: '/bin/bash',
        shellOptions: '',
      },
    } as IExecAPIExecOptions,

    IDAutoPrefix: '___EXEC___',
  }

  static regexes = {
    commandSplit: /[^\s"]+|"([^"]*)"/gi,
  }

  static instances = {
    textDecoder: new TextDecoder(),
  }

  static getters = {
    command<
      T1 extends {
        readonly command: string | Array<string>
        readonly withShell?: IExecAPIExecOptions['withShell']
        readonly withShellOptions?: IExecAPIExecOptions['withShellOptions']
      }
    >({ command, withShell, withShellOptions }: T1): Array<string> {
      const commandContainsPipe =
        typeof command === 'string' && command.includes(' | ')
      const commandReturned: Array<string> = []
      const cmdFullShell =
        withShell && withShellOptions?.shellFullPath
          ? `${withShellOptions.shellFullPath}`
          : ''

      if (cmdFullShell) {
        commandReturned.push(
          cmdFullShell,

          withShellOptions?.doLogin ? '--login' : '',

          withShell && withShellOptions?.shellOptions
            ? withShellOptions.shellOptions.trim()
            : '',

          '-c',

          Array.isArray(command)
            ? command.reduce((acc, commandPart, index) => {
                acc += `${commandPart.trim()}${
                  index !== command.length - 1 ? ' ' : ''
                }`
                return acc
              }, '')
            : command
        )

        return commandReturned.filter(ClassArray.chains.truthy)
      } else {
        return Array.isArray(command)
          ? command.map((x) => x.trim())
          : commandContainsPipe && withShell
          ? [command.trim()]
          : Exec.utils.splitCommand({ command })
      }
    },
  }

  static utils = {
    splitCommand<T1 extends { readonly command: string }>({
      command: commandInput,
    }: T1) {
      const command = commandInput.trim()
      const splitsReturned: Array<string> = []
      let match: ReturnType<RegExp['exec']> = null

      do {
        match = Exec.regexes.commandSplit.exec(command)
        // Index 0 is the matched text, index 1 in the array is the captured group if it exists
        match && splitsReturned.push(match[1] || match[0])
      } while (match)

      return splitsReturned
    },
  }

  static API = {
    async exec<T1 extends IExecAPIExecOptions>({
      getCommand,
      optionsRun: optionsRunInput,
      ...optionsInput
    }: T1) {
      const optionsRun = {
        // contains piped stdErr, stdOut
        ...Exec.defaults.optionsDenoRun,
        ...optionsRunInput,
      }
      const options = { ...Exec.defaults.optionsAPIExec, ...optionsInput }

      switch (options.modeOutput) {
        case IOutputMode.None:
          Object.assign(optionsRun, {
            stderr: 'null',
            stdout: 'null',
          })
          break

        case IOutputMode.StdOutErr:
          Object.assign(optionsRun, {
            stderr: 'inherit',
            stdout: 'inherit',
          })
      }

      const commandAsArray = Exec.getters.command({
        command: await getCommand({ defaults: Exec.defaults, shellEscapeTag }),
        withShell: options.withShell,
        withShellOptions: options.withShellOptions,
      })
      const env = options.withEnv
        ? {
            ...Exec.DH.dependencies.Deno.env.toObject(),
            ...optionsRun.env,
          }
        : {}

      const process = Exec.DH.dependencies.Deno.run({
        env,
        // user overriden
        ...optionsRun,

        // user not overrideable
        cmd: commandAsArray,
      })
      const flags = {
        isProcessStdErrPiped: optionsRun.stderr === 'piped',
        isProcessStdOutPiped: optionsRun.stdout === 'piped',
      }

      const stateLocal = {
        outputString: {
          stdOut: '',
          stdErr: '',
        },
      }

      await Promise.all<any>([
        flags.isProcessStdOutPiped &&
          process.output().then((stdOut) => {
            stateLocal.outputString.stdOut =
              Exec.instances.textDecoder.decode(stdOut)
          }),
        flags.isProcessStdErrPiped &&
          process.stderrOutput().then((stdErr) => {
            stateLocal.outputString.stdErr =
              Exec.instances.textDecoder.decode(stdErr)
          }),
      ])

      const status = await process.status()

      !flags.isProcessStdErrPiped && process.stderr?.close()
      !flags.isProcessStdOutPiped && process.stdout?.close()
      process.close()

      if (options.throwOnCommandError && !status.success) {
        console.log(stateLocal.outputString.stdOut)
        console.error(stateLocal.outputString.stdErr)
        throw new Error(`command failed ===> ${commandAsArray.join(' ')}`)
      }

      if (options.trimOutputs) {
        Object.keys(stateLocal.outputString).forEach((keyOutputs) => {
          const k: keyof typeof stateLocal.outputString = keyOutputs as any
          const value = stateLocal.outputString[k]
          stateLocal.outputString[k] = value.trim()
        })
      }

      return {
        command: {
          array: commandAsArray,
          string: commandAsArray.join(' '),
        },
        env,
        outputs: stateLocal.outputString,
        status,
      }
    },

    async execMulti<T1 extends IExecAPIExecMultiOptions>({
      getCommands,
      ...options
    }: T1) {
      const dataArray = [] as Array<
        TAsyncReturnType<typeof Exec['API']['exec']>
      >
      const dataObject = {} as {
        [keyID: string]: TAsyncReturnType<typeof Exec['API']['exec']>
      }
      const stateLocal = {
        linkCounter: 0,
        IDCounter: 0,
        IDsUnique: new Set<string>(),
        IDCommandCurrent: '',
        IDCommandPrevious: '',
        payloadsByID: {
          envAdded: {} as { [keyID: string]: string },
        },

        getIDAutoByCounter() {
          this.IDCommandPrevious = this.IDCommandCurrent
          this.IDCommandCurrent = `${Exec.defaults.IDAutoPrefix}${this
            .IDCounter++}`

          return this.IDCommandCurrent
        },

        commandMultiToObject<
          T1 extends {
            readonly getCommandsResults: TExecAPIExecMultiReturnSingle
          }
        >({ getCommandsResults }: T1) {
          if (
            typeof getCommandsResults === 'string' ||
            Array.isArray(getCommandsResults)
          ) {
            return {
              getCommand: () => getCommandsResults,
              ID: this.getIDAutoByCounter(),
            } as IExecAPIExecMultiReturnSingleObjectReturned
          }

          return (
            getCommandsResults.ID
              ? getCommandsResults
              : {
                  ...getCommandsResults,
                  ID: this.getIDAutoByCounter(),
                }
          ) as IExecAPIExecMultiReturnSingleObjectReturned
        },
      }

      const returned = {
        dataArray,
        dataObject,
        envAdded: stateLocal.payloadsByID.envAdded,
      }

      try {
        for (const getCommandsResults of await getCommands({
          defaults: Exec.defaults,
          shellEscapeTag,
        })) {
          const resultsGetCommand = stateLocal.commandMultiToObject({
            getCommandsResults,
          })

          if (stateLocal.IDsUnique.has(resultsGetCommand.ID)) {
            throw new Error(`ID: "${resultsGetCommand.ID}" duplicate found`)
          }

          if (resultsGetCommand.onBeforeCommand) {
            const resultsOnBeforeCommand =
              await resultsGetCommand.onBeforeCommand(returned)

            if (resultsOnBeforeCommand) {
              if (resultsOnBeforeCommand.break) {
                break
              }

              if (resultsOnBeforeCommand.continue) {
                continue
              }
            }
          }

          const resultsExec = await Exec.API.exec({
            getCommand: () =>
              resultsGetCommand.getCommand({
                IDCommandCurrent: resultsGetCommand.ID,
                IDCommandPrevious: stateLocal.IDCommandPrevious,
              }),

            ...options,
            ...resultsGetCommand.optionsExec,

            // non overrideables
            optionsRun: {
              ...options.optionsRun,
              env: {
                ...options.optionsRun?.env,
                ...stateLocal.payloadsByID.envAdded,
              },
            },
            withShell: true,
            withEnv: true,
          })

          dataArray.push(resultsExec)
          dataObject[resultsGetCommand.ID] = resultsExec
          stateLocal.IDsUnique.add(resultsGetCommand.ID)
          stateLocal.payloadsByID.envAdded[resultsGetCommand.ID] =
            resultsExec.outputs.stdOut

          if (resultsGetCommand.onAfterCommand) {
            const resultsOnAfterCommand =
              await resultsGetCommand.onAfterCommand(returned)

            if (resultsOnAfterCommand && resultsOnAfterCommand.break) {
              break
            }
          }
        }

        return returned
      } finally {
        stateLocal.IDsUnique.clear()
      }
    },
  }
}
