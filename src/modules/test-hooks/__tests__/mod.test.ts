import { delay } from 'https://deno.land/x/delay@v0.2.0/mod.ts'

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  group,
  test,
} from '../mod.ts'

const quiet = true

const encoder = new TextEncoder()
function log(...strs: string[]): void {
  if (quiet) {
    return
  }

  const msg = " '" + strs.join(' ') + "' "
  Deno.stdout.writeSync(encoder.encode(msg))
}

beforeAll(() => {
  log('before all global')
})

beforeAll(() => {
  log('second before all global')
})

beforeEach(() => {
  log('before each global')
})

afterEach(() => {
  log('after each global')
})

afterAll(() => {
  log('after all global')
})

test({
  name: '1',
  fn() {
    log('1')
  },
})

test({
  name: '2',
  fn() {
    log('2')
  },
  ignore: true,
})

test({
  name: '3',
  async fn() {
    await new Promise((resolve) => setTimeout(resolve, 100))
    log('3')
  },
})

group('group 1', () => {
  beforeAll(() => {
    log('before all group 1')
  })

  beforeEach(() => {
    log('before each group 1')
  })

  afterEach(() => {
    log('after each group 1')
  })

  afterAll(() => {
    log('after all group 1')
  })

  test({
    name: '1',
    fn() {
      log('1')
    },
  })

  test({
    name: '2',
    fn() {
      log('2')
    },
    ignore: true,
  })

  test({
    name: '3',
    async fn() {
      await new Promise((resolve) => setTimeout(resolve, 100))
      log('3')
    },
  })
})

group('group 2', () => {
  beforeAll(() => {
    log('before all group 2')
  })

  beforeEach(() => {
    log('before each group 2')
  })

  afterEach(() => {
    log('after each group 2')
  })

  afterAll(() => {
    log('after all group 2')
  })

  test({
    name: '1',
    fn() {
      log('1')
    },
  })

  group('group 3', () => {
    beforeAll(() => {
      log('before all group 3')
    })

    beforeEach(() => {
      log('before each group 3')
    })

    afterEach(() => {
      log('after each group 3')
    })

    afterAll(() => {
      log('after all group 3')
    })

    test({
      name: '1',
      fn() {
        log('1')
      },
    })

    test({
      name: '2',
      fn() {
        log('2')
      },
      ignore: true,
    })

    test({
      name: '3',
      async fn() {
        await delay(0)
        log('3')
      },
    })
  })

  test({
    name: '3',
    async fn() {
      await delay(0)
      log('3')
    },
  })
})
