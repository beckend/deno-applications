import { walk } from 'https://deno.land/std@0.114.0/fs/mod.ts'
import PQueue from 'https://deno.land/x/p_queue@1.0.1/mod.ts'

import { IOutputMode, Exec } from '../exec/mod.ts'
import { ShellCommand } from '../shell-command/mod.ts'

class Script {
  static instances = {
    queueJobs: new PQueue({ concurrency: 30 }),
  }

  static defaults = {
    extensionsSearch: ['ts', 'tsx'],
  }

  static utils = {
    async getDirectory() {
      const targetDir: string = Deno.args[0]
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
    const state = {
      queueJobs: new PQueue({ concurrency: 30 }),
    }
    for await (const entry of walk(await Script.utils.getDirectory())) {
      if (
        entry.isFile &&
        Script.defaults.extensionsSearch.some((ext) =>
          entry.name.endsWith(`.${ext}`)
        )
      ) {
        state.queueJobs.add(() =>
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
      }
    }

    return state.queueJobs.onIdle()
  }
}

try {
  await Script.main()
} catch (err) {
  throw err
}
