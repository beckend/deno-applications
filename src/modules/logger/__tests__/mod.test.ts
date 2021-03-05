import { delay } from 'https://deno.land/x/delay@v0.2.0/mod.ts'

import { group, test } from '../../test-hooks/mod.ts'
import { Logger as TargetModule, Level } from '../mod.ts'

group(TargetModule.name, () => {
  group('static', () => {
    group('New', () => {
      test({
        name: 'logs',
        async fn() {
          const l = await TargetModule.New({
            levelLog: Level.Trace,
            name: 'test',
          })
          l.info('test', { name: 'tester' })

          await delay(3)
          l.error('nop')
          await delay(3)
          l.debug('debug')
          await delay(3)
          ;(await l.logWithTimeElapsedMS()).info('end')
        },
      })

      test({
        name: 'extendNew',
        async fn() {
          const instance = await TargetModule.New({
            levelLog: Level.Trace,
            name: 'test',
          })
          const logger = await instance.extendNew({
            fields: {
              hello: 'world',
              nope: 'yes',
            },
          })
          logger.info('test', { name: 'tester' })

          const logger2 = await logger.withFields({
            something: 'more',
          })
          logger2.warn('warn')

          logger2.debug('dbg')
          ;(await logger2.logWithTimeElapsedMS()).info('end')
        },
      })
    })
  })
})
