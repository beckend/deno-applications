import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.152.0/testing/asserts.ts'

import { delay, Poll as ClassMain, ErrorPollTimeout } from '../mod.ts'
import { group, test } from '../../test-hooks/mod.ts'

group(ClassMain.name, () => {
  group('success', () => {
    test({
      name: 'stop polling when fn returns payload',
      async fn() {
        const results = await ClassMain.API.poll({
          delayInitial: true,
          delayMS: 1,
          async fn() {
            await delay(100)

            return {
              hello: 2,
              hello2: 3,
              stopPoll: true,
            }
          },
        })

        assertEquals(results.fnReturned, {
          hello: 2,
          hello2: 3,
          stopPoll: true,
        })
        assertEquals(typeof results.timeElapsedMS, 'number')
      },
    })

    test({
      name: 'fn throws are accepted',
      async fn() {
        const stateLocal = {
          counter: 0,
        }

        const results = await ClassMain.API.poll({
          delayMS: 1,
          fn() {
            if (stateLocal.counter++ < 2) {
              throw new Error('i am not done')
            }

            return {
              stopPoll: true,
            }
          },
        })

        assertEquals(typeof results.timeElapsedMS, 'number')
        assertEquals(stateLocal.counter, 3)
      },
    })

    test({
      name: 'stop polling when fn returns payload and timeout is not reached',
      async fn() {
        const results = await ClassMain.API.poll({
          delayMS: 0,
          fn() {
            return {
              stopPoll: true,
            }
          },
          timeoutMS: 2000,
        })

        assertEquals(typeof results.timeElapsedMS, 'number')
      },
    })
  })

  group('failure', () => {
    test({
      name: 'ErrorPollTimeout occurs',
      fn: () =>
        assertRejects(
          () =>
            ClassMain.API.poll({
              delayMS: 2000,
              async fn() {
                await delay(2000)

                return {
                  stopPoll: true,
                }
              },
              timeoutMS: 0,
            }),
          ErrorPollTimeout,
          'Timeout after 0ms'
        ),
    })
  })
})
