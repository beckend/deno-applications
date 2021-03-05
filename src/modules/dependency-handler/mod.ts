import {
  DeepMergeLeafURI,
  deepmergeCustom,
} from 'https://deno.land/x/deepmergets@v4.2.1/dist/deno/mod.ts'

import { TGenericObject, TRecursivePartial } from '../../model/mod.ts'

const customDeepmerge = deepmergeCustom<{
  DeepMergeArraysURI: DeepMergeLeafURI // <-- Needed for correct output type.
}>({
  mergeArrays: false,
  mergeSets: false,
})

export class DependencyHandler<
  T1 extends {
    readonly dependencies: TGenericObject
  }
> {
  data: Map<
    DependencyHandler<T1>,
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
    return this.data.get(this)!['dependencies']
  }

  dependenciesSet = (dependencies: TRecursivePartial<T1['dependencies']>) => {
    this.data.set(this, {
      dependencies: customDeepmerge(this.dependencies, dependencies),
    })

    return this.dependencies
  }

  dependenciesRestore = () => {
    this.data.set(this, { dependencies: this.originals.dependencies })
  }
}
