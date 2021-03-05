import { ScriptsConfiguration } from 'https://deno.land/x/velociraptor@1.3.0/mod.ts'

export default <ScriptsConfiguration>{
  scripts: {
    test: {
      cmd: 'rm -rf ./cov_profile* 2>&1 >/dev/null ; deno test --no-check -A --unstable --coverage=cov_profile',
    },

    coverage: {
      cmd: 'deno coverage --unstable cov_profile --exclude="test-hooks"',
    },

    lint: {
      cmd: 'deno lint --unstable --config ./.vscode/deno.jsonc ./**/*',
    },

    update: {
      cmd: `deno run --no-check -A --unstable ./src/modules/update-modules/mod.ts ./src`,
    },

    installDeps: {
      cmd: 'deno install -A -f -n udd https://deno.land/x/udd/main.ts',
    },
  },
}
