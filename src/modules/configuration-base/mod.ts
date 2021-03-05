// deno-lint-ignore-file no-explicit-any
import { join } from 'https://deno.land/std@0.152.0/path/mod.ts'

import { fileHandler } from '../singletons/file-handler.ts'
import { TGenericObject } from '../../model/mod.ts'
import { ld } from '../lodash/mod.ts'

export interface IParsedEnv {
  [x: string]: string | number | boolean | undefined
}

export class ConfigurationBase {
  static getters = {
    runEnv<
      T1 extends {
        readonly env: IParsedEnv
      }
    >({ env }: T1) {
      return ConfigurationBase.getters.getEnvValue(env, 'RUN_ENV', String)
    },

    getParseEnv(envOriginal: ReturnType<typeof Deno['env']['toObject']>) {
      return Object.keys(envOriginal).reduce((acc, k) => {
        const value = envOriginal[k]

        if (typeof value === 'string') {
          if (['false', 'true'].includes(value)) {
            acc[k] = value === 'true'
          } else {
            const valueInNumber = +value
            acc[k] = Number.isNaN(valueInNumber) ? value : valueInNumber
          }
        }

        return acc
      }, {} as IParsedEnv)
    },

    getEnvValue<
      TEnv extends Record<string, string | number | boolean | undefined>,
      TReturn extends
        | typeof String
        | typeof Number
        | typeof Boolean
        | number
        | undefined
    >(
      env: TEnv,
      key: keyof TEnv & (string | number),
      returnType: TReturn,
      throwOnFail = true
    ): TReturn extends typeof String
      ? string
      : TReturn extends typeof Number
      ? number
      : TReturn extends typeof Boolean
      ? boolean
      : TReturn extends undefined
      ? undefined
      : unknown {
      const value = env[key] as any

      let errMessage: string | undefined

      if ([undefined, 'undefined'].includes(value)) {
        errMessage = `Environment key: "${key}" value  was not found.`
      } else if (returnType === String) {
        if (typeof value !== 'string') {
          errMessage = `Environment key: "${key}" with value: "${value}" is not a type string. Got type: ${typeof value}.`
        }
      } else if (returnType === Number) {
        if (typeof value !== 'number') {
          errMessage = `Environment key: "${key}" with value: "${value}" is not a type number. Got type: ${typeof value}.`
        }
      } else if (returnType === Boolean) {
        if (typeof value !== 'boolean') {
          errMessage = `Environment key: "${key}" with value: "${value}" is not a type Boolean. Got type: ${typeof value}.`
        }
      } else {
        errMessage = `Environment key: "${key}" with value: "${value}" is an unsupported type "${returnType}". Got type: ${typeof value}.`
      }

      if (errMessage) {
        if (throwOnFail) {
          throw new Error(errMessage)
        }

        // eslint-disable-next-line no-console
        console.warn(errMessage)
      }

      return value
    },

    pathSanitized<T1 extends { readonly path: string }>({ path }: T1) {
      const dirHome = Deno.env.get('HOME')

      if (!dirHome) {
        throw new Error('Failed to get env.HOME')
      }

      if (path.startsWith('~')) {
        return path.replace('~', dirHome)
      }

      return path
    },
  }
}

// keeping it async in case we want to read from filesystem in some cases
export const createConfiguration = async <
  T1 extends {
    pathConfigs?: string
  }
>(
  options?: T1
) => {
  const envParsed = ConfigurationBase.getters.getParseEnv(Deno.env.toObject())
  const {
    pathConfigs = ConfigurationBase.getters.getEnvValue(
      envParsed,
      'APP_CONFIG_DIR_JS',
      String
    ),
  } = options || {}
  const runEnv = ConfigurationBase.getters.getEnvValue(
    envParsed,
    'RUN_ENV',
    String
  )

  // the priority matters since the latest overwrites the earlier
  const resultConfigs = await Promise.all([
    fileHandler.loadersModule
      .toml({
        pathFile: join(pathConfigs, 'base.toml'),
      })
      .catch(() => undefined),

    fileHandler.loadersModule
      .toml({
        pathFile: join(
          pathConfigs,
          runEnv === 'production' ? 'production.toml' : 'development.toml'
        ),
      })
      .catch(() => undefined),

    fileHandler.loadersModule
      .toml({
        pathFile: join(pathConfigs, 'local.toml'),
      })
      .catch(() => undefined),
  ])

  return resultConfigs.reduce(
    (acc, config) => ld.merge(acc, config),
    {} as TGenericObject
  )
}
