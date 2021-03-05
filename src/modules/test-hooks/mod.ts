import { TestHooks as TestHooksImport } from './test-hooks.ts'
export { ErrorTestHooksInvalidTestDefinition } from './test-hooks.ts'

const instance = new TestHooksImport()
const { beforeAll, beforeEach, afterAll, afterEach, group, test } = instance.API

export { beforeAll, beforeEach, afterAll, afterEach, group, test }

export { TestHooksImport as TestHooks, instance as testHooks }
