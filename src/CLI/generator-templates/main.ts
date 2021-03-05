// deno-lint-ignore-file no-explicit-any no-this-alias
import { cac } from 'https://unpkg.com/cac/mod.ts'
import { extname } from 'https://deno.land/std@0.114.0/path/mod.ts'
import { copy } from 'https://deno.land/std@0.114.0/streams/conversion.ts'

import { ld } from '../../modules/lodash/mod.ts'
import { TGenericObject } from '../../model/mod.ts'
import { CustomError } from '../../modules/custom-error/mod.ts'
import { DependencyHandler } from '../../modules/dependency-handler/mod.ts'
import { TemplateGeneratorEJS } from './template-generator-ejs.ts'
import { TemplateGeneratorGeneric } from './template-generator-generic.ts'
import { fileHandler } from '../../modules/singletons/file-handler.ts'

export type TValidVarsTypes = keyof typeof fileHandler.loadersModule | 'plain'

export interface IHandlersTemplateOutputOptions
  extends ReturnType<TemplateGeneratorGeneric['generateTemplate']> {
  readonly fileOutput?: string
  readonly fileOutputCreateDirectory: boolean
}

export class ErrorTemplateEngineNotAvailable extends CustomError {
  constructor(message: string) {
    super(message)
  }
}

export class GeneratorTemplates {
  DH = new DependencyHandler({
    dependencies: {
      Deno,

      enginesAvailable: {
        ejs: {
          class: TemplateGeneratorEJS,
        },
      },

      fileHandler,

      streams: {
        copy,
      },
    },
  })

  checks = {
    engine: ({ nameEngine }: { readonly nameEngine: string }) => {
      if (!(this as any).DH.dependencies.enginesAvailable[nameEngine as any]) {
        throw new ErrorTemplateEngineNotAvailable(
          `template engine: "${nameEngine}" is not available, use one of:${Object.keys(
            this.DH.dependencies.enginesAvailable
          ).reduce((acc, nameEngine) => {
            acc += ` "${nameEngine}"`

            return acc
          }, '')}`
        )
      }
    },

    vars: ({
      vars,
      varsType,
    }: {
      readonly vars?: string
      readonly varsType?: string | TGenericObject
    }) => {
      const varIsValid = vars && (ld.isString(vars) || ld.isObject(vars))
      const varTypeIsValid =
        varsType && (ld.isString(varsType) || ld.isObject(varsType))

      if (varIsValid && !varTypeIsValid) {
        throw new Error('--vars was provided but missing --vars-type')
      } else if (!varIsValid && varTypeIsValid) {
        throw new Error('--vars-type is provided but missing --vars')
      }
    },

    source: async ({
      source,
    }: {
      readonly source?: string
    }): Promise<{
      readonly contentFile: string
      readonly pathFile?: string
    }> => {
      if (typeof source !== 'string' || !source) {
        throw new Error('--source is required as string or file path')
      }

      try {
        const contentFile = await this.DH.dependencies.Deno.readTextFile(source)

        return {
          contentFile,
          pathFile: source,
        }
      } catch {
        return {
          contentFile: source,
          pathFile: undefined,
        }
      }
    },
  }

  handlersCMD = {
    vars: <
      T1 extends {
        readonly vars?: string | TGenericObject
        readonly varsType?: string
      }
    >({
      vars: varsInput,
      varsType,
    }: T1): Promise<TGenericObject> | TGenericObject => {
      type TReturn = T1['vars'] extends TGenericObject
        ? T1['vars']
        : T1['vars'] extends string
        ? TGenericObject
        : never

      if (!varsInput || (!varsInput && !varsType)) {
        return {}
      }

      if (ld.isObject(varsInput) && varsType === 'plain') {
        return varsInput as TGenericObject
      }

      const vars = varsInput as any as string
      const that = this

      const fileExtensionFromVars = extname(vars)
      const varsIsFile = Boolean(fileExtensionFromVars)
      const fileExtensionCheckToCheck = varsType || fileExtensionFromVars || ''
      // user can override extension handling by supplying varsType, this is due to the ability to pass vars as a string unknown contents
      const detectedFileExtension = (
        fileExtensionCheckToCheck.startsWith('.')
          ? fileExtensionCheckToCheck.replace('.', '')
          : fileExtensionCheckToCheck
      ) as keyof typeof that.DH.dependencies.fileHandler.loadersModule

      if (detectedFileExtension) {
        const varsHandlerFn =
          this.DH.dependencies.fileHandler.loadersModule[detectedFileExtension]

        if (varsHandlerFn) {
          return varsHandlerFn(
            varsIsFile
              ? {
                  pathFile: vars,
                }
              : {
                  contentFile: vars,
                }
          ) as Promise<TReturn>
        } else {
          throw new Error(
            `No function to handle detected extension: ${detectedFileExtension} from either --vars-type or --vars`
          )
        }
      }

      return {} as TReturn
    },
  }

  handlersTemplate = {
    output: async <T1 extends IHandlersTemplateOutputOptions>({
      fileOutput,
      fileOutputCreateDirectory,
      templateReader,
      templateString,
    }: T1): Promise<{
      readonly templateReader?: Deno.Reader
      readonly templateString?: string
    }> => {
      if (!templateString && !templateReader) {
        throw new Error('No template output source provided in arguments.')
      }

      if (fileOutput) {
        if (templateReader) {
          const resultsWriteFile =
            await this.DH.dependencies.fileHandler.API.writeFile({
              pathFile: fileOutput,
              createDirectory: fileOutputCreateDirectory,
              readerSource: templateReader,
              returnContent: true,
            })

          console.log(resultsWriteFile.contentFile || '')

          return {
            templateString: resultsWriteFile.contentFile,
            templateReader: resultsWriteFile.readerSource,
          }
        } else {
          const resultsWriteFile =
            await this.DH.dependencies.fileHandler.API.writeFile({
              contentFile: templateString,
              createDirectory: fileOutputCreateDirectory,
              pathFile: fileOutput,
              returnContent: true,
            })

          console.log(resultsWriteFile.contentFile || '')

          return {
            templateString: resultsWriteFile.contentFile,
          }
        }
      }

      if (templateReader) {
        await this.DH.dependencies.streams.copy(
          await templateReader!,
          this.DH.dependencies.Deno.stdout
        )

        return {
          templateReader: await templateReader,
        }
      } else {
        const templateStringResults = await templateString
        console.log(templateStringResults)
        return { templateString: templateStringResults }
      }
    },
  }

  API = {
    generate: async <
      T1 extends {
        readonly engine: string
        readonly fileOutput?: string
        readonly fileOutputCreateDirectory?: string
        readonly source: string
        readonly vars?: string | TGenericObject
        readonly varsType?: TValidVarsTypes
      }
    >({
      engine: engineInput,
      fileOutput,
      fileOutputCreateDirectory = 'TRUE',
      source: sourceInput,
      vars,
      varsType,
    }: T1) => {
      this.checks.engine({ nameEngine: engineInput })
      const payloadSource = await this.checks.source({
        source: sourceInput,
      })
      const that = this
      const engine =
        engineInput as keyof typeof that.DH.dependencies.enginesAvailable

      const EngineClass = that.DH.dependencies.enginesAvailable[engine].class

      return this.handlersTemplate.output({
        fileOutput,
        fileOutputCreateDirectory:
          fileOutputCreateDirectory.toLocaleUpperCase() === 'TRUE',
        ...(await new EngineClass().generateTemplate({
          ...payloadSource,
          vars: await this.handlersCMD.vars({
            vars,
            varsType: varsType || 'plain',
          }),
        })),
      })
    },
  }

  CLI = cac(GeneratorTemplates.name)

  init = async ({ ARGV }: { readonly ARGV?: Array<string> } = {}) => {
    Object.values(this.cmdInits).forEach((x) => x())

    this.CLI.help()

    // check source for parse function, and this is what it uses
    this.CLI.parse(['deno', 'cli'].concat(ARGV || Deno.args), { run: false })
    await this.CLI.runMatchedCommand()
  }

  cmdInits = {
    generate: () => {
      this.CLI.command('generate', 'Generates template using ejs syntax')
        .option(
          '--source <string-or-file-path>',
          'source as string or file path'
        )
        .option(
          '--file-output [file-path]',
          'if supplied will output as a file instead of stdout'
        )
        .option(
          '--file-output-create-directory [true | false]',
          'if true then creates the directory if it does not exist, default true'
        )
        .option('--vars [string-or-file-path]', 'vars as string or file path')
        .option(
          '--vars-type [string]',
          'vars type as string if no file extension is detected (such as string vars), - .ts file with key import "vars", yaml, json'
        )
        .option(
          '--engine <string>',
          'template engine to parse, available: "ejs"'
        )
        .action((options) => this.API.generate(options))
    },
  }
}
