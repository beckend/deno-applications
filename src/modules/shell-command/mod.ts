import { EOL } from 'https://deno.land/std@0.152.0/fs/eol.ts'

import { CustomError } from '../custom-error/mod.ts'
import { TAsyncReturnType } from '../../model/mod.ts'
import { IExecAPIExecOptions, Exec } from '../exec/mod.ts'

export class ErrorShellCommandNotFound extends CustomError {
  constructor(message: string) {
    super(message)
  }
}

export interface IShellCommandCommandExistsOptionsBase {
  readonly optionsExec?: IExecAPIExecOptions
}
export interface IShellCommandCommandExistsOptions
  extends IShellCommandCommandExistsOptionsBase {
  readonly command: string
  readonly throwOnFail?: boolean
}
export interface IShellCommandCommandExistsMultiOptions
  extends IShellCommandCommandExistsOptionsBase {
  readonly commands: Array<string>
  readonly throwOnFail?: boolean
}
export interface IShellCommandCheckRequiredCommandsOptions
  extends IShellCommandCommandExistsOptionsBase {
  readonly commandsSpecification: {
    readonly [nameCommand: string]: {
      readonly messageError: string
    }
  }
}

export class ShellCommand {
  static API = {
    async commandExists({
      command,
      optionsExec,
      throwOnFail = true,
    }: IShellCommandCommandExistsOptions) {
      const payload = await Exec.API.exec({
        ...optionsExec,
        getCommand: () => `command -v ${command}`,
        throwOnCommandError: false,
        withShell: true,
      })

      if (throwOnFail && !payload.status.success) {
        console.error(payload.outputs.stdErr)

        throw new ErrorShellCommandNotFound(
          `command "${command}" is not available using ===> ${payload.command.string}`
        )
      }

      return {
        ...payload,
        nameCommand: command,
      }
    },

    async commandExistsMulti({
      commands,
      ...optionsRest
    }: IShellCommandCommandExistsMultiOptions) {
      const dataObject = {} as {
        [key: string]: TAsyncReturnType<
          typeof ShellCommand['API']['commandExists']
        >
      }
      const dataObjectError = { ...dataObject }
      const dataArrayError = [] as Array<
        TAsyncReturnType<typeof ShellCommand['API']['commandExists']>
      >
      const errorsCommandNotFound = [] as Array<string>

      const dataArray = await Promise.all(
        commands.reduce((acc, commmandStr) => {
          acc.push(
            ShellCommand.API.commandExists({
              ...optionsRest,
              command: commmandStr,
              throwOnFail: false,
            }).then((x) => {
              if (!x.status.success) {
                errorsCommandNotFound.push(commmandStr)
                dataObjectError[commmandStr] = x
                dataArrayError.push(x)
              }

              dataObject[commmandStr] = x
              return x
            })
          )
          return acc
        }, [] as Array<ReturnType<typeof ShellCommand['API']['commandExists']>>)
      )

      if (optionsRest.throwOnFail && errorsCommandNotFound.length) {
        const errorsCommandNotFoundLastIndex = errorsCommandNotFound.length - 1

        throw new ErrorShellCommandNotFound(
          errorsCommandNotFound.reduce((acc, commandStr, index) => {
            acc += commandStr

            if (index !== errorsCommandNotFoundLastIndex) {
              acc += ' '
            }

            return acc
          }, 'commands that does not exists: ')
        )
      }

      return {
        dataArray,
        dataObject,
        dataArrayError,
        dataObjectError,
      }
    },

    async checkRequiredCommands({
      commandsSpecification,
      ...optionsCommandExistsMulti
    }: IShellCommandCheckRequiredCommandsOptions) {
      const commandsToCheck = Object.keys(commandsSpecification)

      if (!commandsToCheck.length) {
        throw new Error('No commands supplied as keys.')
      }

      const results = await ShellCommand.API.commandExistsMulti({
        ...optionsCommandExistsMulti,
        commands: commandsToCheck,
        throwOnFail: false,
      })

      if (results.dataArrayError.length) {
        throw new ErrorShellCommandNotFound(
          results.dataArrayError
            .reduce((acc, { nameCommand }) => {
              acc.push(
                `"${nameCommand}" not found, ${commandsSpecification[nameCommand].messageError}`
              )

              return acc
            }, [] as Array<string>)
            .join(EOL.LF)
        )
      }

      return results
    },
  }
}
