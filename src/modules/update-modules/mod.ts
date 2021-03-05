// deno-lint-ignore-file no-explicit-any
import { walk } from 'https://deno.land/std@0.152.0/fs/mod.ts'
import { pLimit } from 'https://deno.land/x/p_limit@v1.0.0/mod.ts'
import { join, normalize } from 'https://deno.land/std@0.152.0/path/mod.ts'

import { IOutputMode, Exec } from '../exec/mod.ts'
import { ShellCommand } from '../shell-command/mod.ts'

class Script {
  static instances = {
    promiseLimitUDD: pLimit(30),
  }

  static defaults = {
    extensionsSearch: ['ts', 'tsx'],
  }

  static utils = {
    async getDirectory() {
      const targetDirBaseNormalized: string = normalize(Deno.args[0])
      const targetDir = targetDirBaseNormalized.startsWith('/')
        ? targetDirBaseNormalized
        : join(Deno.cwd(), targetDirBaseNormalized)

      if (!targetDir) {
        throw new Error(`invalid empty directory as argument`)
      }

      const targetDirF = await Deno.open(targetDir, { read: true })
      const targetDirInfo = await Deno.fstat(targetDirF.rid)

      if (!targetDirInfo.isDirectory) {
        throw new Error(`path ${targetDir} is not a directory`)
      }

      return targetDir
    },
  }

  static tasks = {
    checks() {
      return Promise.all([
        ShellCommand.API.checkRequiredCommands({
          commandsSpecification: {
            udd: {
              messageError:
                'udd is required. install with => deno install -A -f -n udd https://deno.land/x/udd/main.ts',
            },
          },
        }),
      ])
    },
  }

  static async main() {
    await Script.tasks.checks()

    const promises: Array<Promise<any>> = []

    for await (const entry of walk(await Script.utils.getDirectory())) {
      if (
        entry.isFile &&
        Script.defaults.extensionsSearch.some((ext) =>
          entry.name.endsWith(`.${ext}`)
        )
      ) {
        promises.push(
          Script.instances.promiseLimitUDD(() =>
            Exec.API.exec({
              getCommand: () => `udd ${entry.path}`,
              modeOutput: IOutputMode.Capture,
              throwOnCommandError: false,
            }).then(({ outputs, status }) => {
              console.error(outputs.stdErr)
              console.log(outputs.stdOut)

              if (status.success) {
                return undefined
              }

              throw new Error(outputs.stdErr)
            })
          )
        )
      }
    }

    return Promise.all(promises)
  }
}

try {
  await Script.main()
} catch (err) {
  throw err
}
