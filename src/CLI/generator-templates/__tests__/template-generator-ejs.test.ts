import { assertEquals } from 'https://deno.land/std@0.114.0/testing/asserts.ts'

import { group, test } from '../../../modules/test-hooks/mod.ts'
import { TemplateGeneratorEJS as ClassMain } from '../template-generator-ejs.ts'
import { Common } from './common.ts'

group(ClassMain.name, () => {
  group('instance', () => {
    const instance = new ClassMain()
    group('generateTemplate', () => {
      group('success', () => {
        test({
          name: 'option contentFile',
          async fn() {
            assertEquals(
              await (
                await instance.generateTemplate({
                  contentFile: `<% if (user) { %><h2><%= user.name %></h2><% } %>`,
                  vars: {
                    user: {
                      name: 'admin',
                    },
                  },
                })
              ).templateString,
              '<h2>admin</h2>'
            )
          },
        })

        test({
          name: 'includes in template',
          async fn() {
            assertEquals(
              await (
                await instance.generateTemplate({
                  pathFile: Common.path.utils.join(
                    Common.path.dir.fixtures,
                    'ejs/4.ejs'
                  ),
                  vars: {
                    users: [
                      {
                        name: 'admin',
                      },
                      {
                        name: 'admin2',
                      },
                      {
                        name: 'admin3',
                      },
                    ],
                  },
                })
              ).templateString,
              '<ul>\n      <li>admin</li>\n\n      <li>admin2</li>\n\n      <li>admin3</li>\n\n</ul>\n'
            )
          },
        })

        test({
          name: 'includes in template',
          async fn() {
            assertEquals(
              await (
                await instance.generateTemplate({
                  pathFile: Common.path.utils.join(
                    Common.path.dir.fixtures,
                    'ejs/yaml/parent-1.yaml.ejs'
                  ),
                })
              ).templateString,
              `one:\n  two:\n    three:\n      four:\n        five:\n        - name: envoy.filters.http.lua\n          typed_config:\n            "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua\n            inline_code: |\n              local domainsPublic = {\n                'one'\n              }\n\n          - name: something\n`
            )
          },
        })
      })

      test({
        name: 'option pathFile',
        async fn() {
          assertEquals(
            await (
              await instance.generateTemplate({
                pathFile: Common.path.utils.join(
                  Common.path.dir.fixtures,
                  'ejs/1.ejs'
                ),
                vars: {
                  user: {
                    name: 'admin',
                  },
                },
              })
            ).templateString,
            `\n  <h2>admin</h2>\n\n`
          )
        },
      })

      test({
        name: 'option pathFile',
        async fn() {
          assertEquals(
            await (
              await instance.generateTemplate({
                pathFile: Common.path.utils.join(
                  Common.path.dir.fixtures,
                  'ejs/2.ejs'
                ),
                vars: {
                  dirLogs: ['/dir1/dir2', '/dir3/dir4', '/dir5'],
                },
              })
            ).templateString,
            `\n/dir1/dir2/* {\n  maxsize 20M\n  copytruncate\n  rotate 0\n}\n\n\n/dir3/dir4/* {\n  maxsize 20M\n  copytruncate\n  rotate 0\n}\n\n\n/dir5/* {\n  maxsize 20M\n  copytruncate\n  rotate 0\n}\n\n\n`
          )
        },
      })

      test({
        name: 'option pathFile no vars',
        async fn() {
          assertEquals(
            await (
              await instance.generateTemplate({
                pathFile: Common.path.utils.join(
                  Common.path.dir.fixtures,
                  'ejs/3.ejs'
                ),
              })
            ).templateString,
            `<h2>nothing</h2>\n`
          )
        },
      })
    })
  })
})
