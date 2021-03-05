// deno-lint-ignore-file no-explicit-any

import { CustomError } from '../../modules/custom-error/mod.ts'

export class ErrorTestHooksInvalidTestDefinition extends CustomError {
  constructor(message: string) {
    super(message)
  }
}

interface IHooks {
  beforeAll: Array<() => any | Promise<any>>
  beforeEach: Array<() => any | Promise<any>>
  afterEach: Array<() => any | Promise<any>>
  afterAll: Array<() => any | Promise<any>>

  waitingTests: number
  completedTests: number

  onlyTests: number
  completedOnlyTests: number
}

interface IStackItem extends IHooks {
  name: string
}

interface IGlobalContext extends IHooks {
  stack: IStackItem[]
}

export class TestHooks {
  static getters = {
    globalContext(): IGlobalContext {
      return {
        stack: [],

        beforeAll: [],
        beforeEach: [],
        afterEach: [],
        afterAll: [],

        waitingTests: 0,
        completedTests: 0,

        onlyTests: 0,
        completedOnlyTests: 0,
      }
    },

    stackItem({ name }: { readonly name: string }): IStackItem {
      return {
        name,

        beforeAll: [],
        beforeEach: [],
        afterEach: [],
        afterAll: [],

        waitingTests: 0,
        completedTests: 0,

        onlyTests: 0,
        completedOnlyTests: 0,
      }
    },
  }

  static utils = {
    executeAllPromisifiedFunctions<T1 extends Array<() => any | Promise<any>>>(
      fns: T1
    ) {
      return Promise.all(fns.map((fn) => fn()))
    },
  }

  globalContext = TestHooks.getters.globalContext()

  getters = {
    functionPushIntoGlobalContext: <
      T1 extends {
        readonly fn: () => any | Promise<any>
        readonly key: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach'
      }
    >({
      fn,
      key,
    }: {
      readonly fn: T1['fn']
      readonly key: T1['key']
    }) => {
      this.getters.getTopHooks()[key].push(fn)
      return this
    },

    getTopHooks: (): IHooks => {
      if (this.globalContext.stack.length > 0) {
        return this.globalContext.stack[this.globalContext.stack.length - 1]
      } else {
        return this.globalContext
      }
    },
  }

  API = {
    group: (name: string, fn: () => void): void => {
      this.globalContext.stack.push(TestHooks.getters.stackItem({ name }))

      fn()

      this.globalContext.stack.pop()
    },

    beforeAll: <T1 extends () => any | Promise<any>>(fn: T1): void => {
      this.getters.functionPushIntoGlobalContext({
        fn,
        key: 'beforeAll',
      })
    },

    beforeEach: <T1 extends () => any | Promise<any>>(fn: T1): void => {
      this.getters.functionPushIntoGlobalContext({
        fn,
        key: 'beforeEach',
      })
    },

    afterEach: <T1 extends () => any | Promise<any>>(fn: T1): void => {
      this.getters.functionPushIntoGlobalContext({
        fn,
        key: 'afterEach',
      })
    },

    afterAll: <T1 extends () => any | Promise<any>>(fn: T1): void => {
      this.getters.functionPushIntoGlobalContext({
        fn,
        key: 'afterAll',
      })
    },

    test: (t: Deno.TestDefinition): void => {
      // Extract args
      const { name: testName, fn, ...opts } = t

      // Set up waiting count.
      if (!opts.ignore) {
        this.globalContext.waitingTests++
        this.globalContext.stack.map((itemStack) => itemStack.waitingTests++)
      }

      if (opts.only) {
        this.globalContext.onlyTests++
        this.globalContext.stack.map((itemStack) => itemStack.onlyTests++)
      }

      // Generate name.
      const name = this.globalContext.stack.map(({ name: n }) => n)
      name.push(testName)

      // Build hook stack.
      const hooks: IHooks[] = [this.globalContext, ...this.globalContext.stack]
      const revHooks: IHooks[] = [...hooks].reverse()

      Deno.test({
        name: name.join(' > '),
        async fn() {
          // Before.
          for (const { beforeAll, beforeEach, completedTests } of hooks) {
            if (completedTests === 0) {
              await TestHooks.utils.executeAllPromisifiedFunctions(beforeAll)
            }

            await TestHooks.utils.executeAllPromisifiedFunctions(beforeEach)
          }

          // Test.
          await fn({} as any)
          for (const hook of hooks) {
            hook.completedTests++

            if (opts.only) {
              hook.completedOnlyTests++
            }
          }

          // After.
          for (const {
            afterAll,
            afterEach,
            waitingTests,
            completedTests,
            onlyTests,
            completedOnlyTests,
          } of revHooks) {
            await TestHooks.utils.executeAllPromisifiedFunctions(afterEach)

            if (
              waitingTests === completedTests ||
              (onlyTests > 0 && onlyTests === completedOnlyTests)
            ) {
              await TestHooks.utils.executeAllPromisifiedFunctions(afterAll)
            }
          }
        },
        ...opts,
      })
    },
  }
}
