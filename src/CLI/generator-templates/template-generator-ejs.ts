import { TemplateGeneratorGeneric } from './template-generator-generic.ts'
import { ejs } from 'https://deno.land/x/view_engine@v1.5.0/lib/engines/ejs/mod.ts'

export class TemplateGeneratorEJS extends TemplateGeneratorGeneric {
  generateTemplate(
    ...args: Parameters<TemplateGeneratorGeneric['generateTemplate']>
  ) {
    const [{ contentFile, pathFile, vars = {} }] = args

    TemplateGeneratorGeneric.checks.generateTemplate({
      contentFile,
      pathFile,
    })

    const renderFn = pathFile ? ejs.renderFile : ejs.render

    return {
      templateString: renderFn(
        (pathFile ? pathFile : contentFile) as string,
        vars
      ),
    }
  }
}
