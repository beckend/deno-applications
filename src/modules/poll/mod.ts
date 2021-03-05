// deno-lint-ignore-file no-explicit-any no-empty

import { delay } from 'https://deno.land/x/delay@v0.2.0/mod.ts'

import { TAsyncReturnType } from '../../model/mod.ts'
import { CustomError } from '../../modules/custom-error/mod.ts'

export enum EPoll {
  FNPayloadFail = '___FN_FAILED___',
}

export { delay }
export class ErrorPollTimeout extends CustomError {}

export class Poll {
  static defaults = {
    delayMS: 100,
  }

  static API = {
    poll: async <
      T1 extends {
        readonly delayInitial?: boolean
        readonly delayMS?: number
        readonly fn: (...args: Array<any>) => ReturnType<T1['fn']>
        readonly timeoutMS?: number
      }
    >({
      delayInitial,
      delayMS = Poll.defaults.delayMS,
      fn,
      timeoutMS,
    }: T1) => {
      const stateLocal = {
        timeStart: new Date(),
      }

      if (delayInitial) {
        await delay(delayMS)
      }

      let fnReturned: T1['fn'] extends (...args: any) => Promise<any>
        ? TAsyncReturnType<T1['fn']>
        : ReturnType<T1['fn']> = undefined as any

      if (typeof timeoutMS === 'number') {
        const handlers = {
          checkTimeout: () => {
            const diffFromStartInMs: number =
              new (Date as any)() - (stateLocal as any).timeStart

            if (diffFromStartInMs >= timeoutMS) {
              throw new ErrorPollTimeout(`Timeout after ${diffFromStartInMs}`)
            }
          },
        }

        while (true) {
          try {
            handlers.checkTimeout()

            await delay(delayMS)

            fnReturned = (await fn()) as any

            if (fnReturned && (fnReturned as any).stopPoll) {
              break
            }
          } catch (err) {
            if (err instanceof ErrorPollTimeout) {
              throw err
            }
          }
        }
      } else {
        while (true) {
          try {
            await delay(delayMS)

            fnReturned = (await fn()) as any

            if (fnReturned && (fnReturned as any).stopPoll) {
              break
            }
          } catch {}
        }
      }

      return {
        fnReturned,
        timeElapsedMS: (new (Date as any)() -
          (stateLocal as any).timeStart) as number,
      }
    },
  }
}
