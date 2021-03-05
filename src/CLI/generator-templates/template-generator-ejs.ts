import { TemplateGeneratorGeneric } from './template-generator-generic.ts'
import { ejs } from 'https://deno.land/x/view_engine@v1.5.0/lib/engines/ejs/mod.ts'

export class TemplateGeneratorEJS extends TemplateGeneratorGeneric {
  async generateTemplate(
    ...args: Parameters<TemplateGeneratorGeneric['generateTemplate']>
  ) {
    const [{ contentFile, pathFile, vars = {} }] = args

    try {
      await TemplateGeneratorGeneric.checks.generateTemplate({
        contentFile,
        pathFile,
      })
    } catch (err) {
      return Promise.reject(err)
    }

    const renderFn = pathFile ? ejs.renderFile : ejs.render

    return {
      templateString: await renderFn(
        (pathFile ? pathFile : contentFile) as string,
        vars
      ),
    }
  }
}
