import { join } from 'https://deno.land/std@0.152.0/path/mod.ts'

const dirCurrent = new URL('.', import.meta.url).pathname.slice(0, -1)
const dirScriptEngineRoot = join(dirCurrent, '../..')

export class Configuration {
  static paths = {
    dir: {
      rootScriptEngine: dirScriptEngineRoot,
    },

    file: {
      tsconfig: join(dirScriptEngineRoot, 'tsconfig.json'),
    },
  }
}

/**
 * Async to prepare for dependencies that would require file or API reads
 */
export const createConfiguration = () =>
  Promise.resolve<Configuration>(new Configuration())
