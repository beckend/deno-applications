import { TGenericObject } from '../../model/mod.ts'
export abstract class TemplateGeneratorGeneric {
  static checks = {
    generateTemplate<
      T1 extends {
        readonly contentFile?: string
        readonly pathFile?: string
      }
    >({ contentFile, pathFile }: T1) {
      if (!contentFile && !pathFile) {
        throw new Error(
          'specify either one of required contentFile or pathFile'
        )
      }

      return {
        contentFile,
        pathFile,
        exists: {
          contentFile: Boolean(contentFile),
          pathFile: Boolean(pathFile),
        },
      }
    },
  }
  abstract generateTemplate<
    T1 extends {
      readonly contentFile?: string
      readonly pathFile?: string
      readonly vars?: TGenericObject
    }
  >(
    options: T1
  ): {
    readonly templateReader?: Promise<Deno.Reader> | Deno.Reader
    readonly templateString?: Promise<string> | string
  }
}
