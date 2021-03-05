export class FixtureClass {
  static staticValue = [1, 2, 3]

  static deepNest = {
    level1: {
      level2: {
        level3: 3,
      },
    },
  }

  instanceValue1 = 5

  instanceMethod1 = () => this.instanceValue1
}

export const fixtureObject = {
  get objectGetter1() {
    return this.instanceValue1
  },

  set objectSetter1(x: number) {
    this.instanceValue1 = x
  },

  instanceValue1: 5,

  objectArray: [1, 2, 3],
}
