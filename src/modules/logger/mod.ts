// deno-lint-ignore-file no-explicit-any require-await
import {
  ConsoleStream,
  Level,
  Logger as LoggerOptic,
  Formatter,
  LogRecord,
} from 'https://deno.land/x/optic@1.3.1/mod.ts'
import { asString } from 'https://deno.land/x/optic@1.3.1/utils/asString.ts'
import * as colors from 'https://deno.land/std@0.114.0/fmt/colors.ts'
import {
  add as dateAdd,
  formatDuration,
  intervalToDuration,
  millisecondsToSeconds,
} from 'https://cdn.skypack.dev/date-fns@2.25.0'

import { TGenericObject } from '../../model/mod.ts'

export { Level, colors }

export class FormatterCustom implements Formatter<string> {
  static getters = {
    colorByLevel(level: Level) {
      switch (level) {
        case Level.Critical:
          return colors.white
        case Level.Debug:
          return colors.white
        case Level.Error:
          return colors.red
        case Level.Warn:
          return colors.yellow
        case Level.Trace:
          return colors.white
        case Level.Info:
          return colors.brightYellow
        default:
          throw new Error('not supported')
      }
    },

    levelToString(level: Level) {
      switch (level) {
        case Level.Critical:
          return 'CRITICAL'
        case Level.Debug:
          return 'DEBUG'
        case Level.Error:
          return 'ERROR'
        case Level.Warn:
          return 'WARN'
        case Level.Trace:
          return 'TRACE'
        case Level.Info:
          return 'INFO'
        default:
          throw new Error('not supported')
      }
    },

    metadata(metadata: unknown[]) {
      let metadataReplacement = ''
      if (metadata.length > 0) {
        for (const metaItem of metadata) {
          metadataReplacement += asString(metaItem) + ' '
        }
        metadataReplacement = metadataReplacement.slice(0, -1)
      }

      return metadataReplacement
    },

    timeMSToHumanClockFormat: (inputMS: number): string => {
      const dateNow = new Date()

      return formatDuration(
        intervalToDuration({
          start: dateNow,
          end: dateAdd(dateNow, {
            seconds: millisecondsToSeconds(inputMS),
          }),
        })
      )
    },
  }

  fields: {
    persistent: TGenericObject
  }
  name: string

  constructor({
    fields,
    name,
  }: {
    readonly fields?: TGenericObject
    readonly name: string
  }) {
    this.name = name
    this.fields = {
      persistent: fields || {},
    }
  }

  getters = {
    fields: () => {
      if (!Object.keys(this.fields.persistent).length) {
        return ''
      }

      const keysFields = Object.keys(this.fields.persistent)
      const keysFieldsIndexMax = keysFields.length - 1

      let returned = keysFields.reduce((acc, key, index) => {
        acc += colors.bold(`${key}=${this.fields.persistent[key]}`)

        if (index !== keysFieldsIndexMax) {
          acc += ', '
        }

        return acc
      }, colors.cyan('['))

      returned += colors.cyan('] ')

      return returned
    },

    timeDifferenceMS: () => {
      if (this.time.logLast === undefined) {
        this.time.logLast = new Date()
        return 0
      }

      const returned = this.getters.timeDifferenceMSHasLogLast()
      this.getters.timeDifferenceMS = this.getters.timeDifferenceMSHasLogLast

      return returned
    },

    timeDifferenceMSHasLogLast: () => {
      const dateNow = new Date()
      const returned = dateNow.getTime() - this.time.logLast!.getTime()
      this.time.logLast = dateNow
      return returned
    },
  }

  time: {
    logLast?: Date
  } = {
    logLast: undefined,
  }

  format(logRecord: LogRecord): string {
    const colorLevel = FormatterCustom.getters.colorByLevel(logRecord.level)
    const timeDifferenceMS = this.getters.timeDifferenceMS()

    return [
      `${colors.bold(colors.bgBrightMagenta(this.name))} `,

      `${colorLevel('[')}${colors.bold(
        FormatterCustom.getters.levelToString(logRecord.level)
      )}${colorLevel(']')} `,

      `${colors.blue('[')}${logRecord.dateTime.toISOString()}${colors.blue(
        ']'
      )} `,

      this.getters.fields(),

      `${colors.cyan('+[')}${timeDifferenceMS}ms${colors.cyan(']')} `,
      timeDifferenceMS > 1000
        ? `${colors.cyan(
            '+['
          )}${FormatterCustom.getters.timeMSToHumanClockFormat(
            timeDifferenceMS
          )}${colors.cyan(']')} `
        : '',

      `${logRecord.msg} `,

      FormatterCustom.getters.metadata(logRecord.metadata),
    ].join('')
  }
}

export interface LoggerCreateNewOptions {
  readonly fields?: TGenericObject
  readonly levelLog: Level
  readonly name: string
  readonly timeLogLast?: Date
}

export interface LoggerCreateNewExtendOptions {
  readonly fields?: TGenericObject
  readonly levelLog?: Level
  readonly name?: string
}

export class LoggerOpticExtended extends LoggerOptic {
  fields?: TGenericObject
  levelLog: Level
  formatterCustom: FormatterCustom
  timeCreated = new Date()

  constructor(
    options: {
      readonly formatter: FormatterCustom
    } & LoggerCreateNewOptions
  ) {
    super(options.name)
    this.levelLog = options.levelLog
    this.fields = options.fields
    this.formatterCustom = options.formatter
    this.formatterCustom.time.logLast = options.timeLogLast
  }

  extendNew = (optionsExtend: LoggerCreateNewExtendOptions) =>
    Logger.New({
      fields: optionsExtend.fields || this.fields,
      levelLog: optionsExtend.levelLog || this.levelLog,
      timeLogLast: this.formatterCustom.time.logLast,
      name: this.name(),
    })

  withFields = (fields: TGenericObject) =>
    this.extendNew({
      fields: {
        ...this.fields,
        ...fields,
      },
    })

  logWithTimeElapsedMS = async () =>
    this.extendNew({
      fields: {
        timeElapsedMS: new Date().getTime() - this.timeCreated.getTime(),
      },
    })
}

export class Logger {
  static async New({
    fields,
    levelLog,
    name,
    timeLogLast,
  }: LoggerCreateNewOptions): Promise<LoggerOpticExtended> {
    const formatter = new FormatterCustom({ fields, name })
    const consoleStream = new ConsoleStream()
      .withMinLogLevel(levelLog)
      .withLogHeader(false)
      .withLogFooter(false)
      .withFormat(formatter)

    return new LoggerOpticExtended({
      fields,
      formatter,
      levelLog,
      name,
      timeLogLast,
    }).addStream(consoleStream) as any
  }
}
