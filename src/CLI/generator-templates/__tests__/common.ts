import { join } from 'https://deno.land/std@0.152.0/path/mod.ts'

const dirCurrent = new URL('.', import.meta.url).pathname.slice(0, -1)

export class Common {
  static path = {
    dir: {
      fixtures: join(dirCurrent, 'fixtures'),
    },

    utils: {
      join,
    },
  }
}
