// deno-lint-ignore-file no-explicit-any

export function createClasses() {
  let staticSetter = undefined as any

  class A {
    static staticMethod() {
      return 'static method'
    }

    static set staticSetter(value) {
      staticSetter = value
    }

    static get staticSetter() {
      return staticSetter
    }

    variable: any

    constructor(variable: any) {
      this.variable = variable
    }

    method(arg = '') {
      return this.variable + arg
    }

    superMethod() {
      return this._privateMethod()
    }

    _privateMethod() {
      return this.variable
    }
  }

  class B extends A {
    constructor(variable: any) {
      super(variable)
    }

    method(...rest: Parameters<A['method']>) {
      return 'B ' + super.method(...rest)
    }
  }

  class C extends A {
    static mapStatic = new Map<string | number, any>()

    map = new Map<string | number, any>()

    constructor(variable: any) {
      super(variable)
    }

    method2() {
      return this.map
    }
  }

  class D {
    method() {
      return 'D'
    }
  }

  return { A, B, C, D }
}
