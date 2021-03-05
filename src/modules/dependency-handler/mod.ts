// deno-lint-ignore-file no-explicit-any
import { TGenericObject } from '../../model/mod.ts'
export class DependencyHandler<
  T1 extends {
    readonly dependencies: TGenericObject
  }
> {
  data: Map<
    typeof DependencyHandler,
    {
      readonly dependencies: T1['dependencies']
    }
  > = new Map()
  originals: {
    dependencies: T1['dependencies']
  }

  constructor({ dependencies }: T1) {
    this.originals = { dependencies: Object.freeze(dependencies) }
    this.dependenciesRestore()
  }

  get dependencies() {
    return this.data.get(this as any)!['dependencies']
  }

  dependenciesSet = (dependencies: Partial<T1['dependencies']>) => {
    this.data.set(this as any, {
      dependencies: {
        ...this.dependencies,
        ...(dependencies as any),
      },
    })

    return this.dependencies
  }

  dependenciesRestore = () => {
    this.data.set(this as any, { dependencies: this.originals.dependencies })
  }
}
