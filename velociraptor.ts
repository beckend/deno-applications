import { ScriptsConfiguration } from 'https://raw.githubusercontent.com/beckend/velociraptor/isolatedModules/mod.ts'

export default <ScriptsConfiguration>{
  scripts: {
    test: {
      cmd: 'rm -rf ./cov_profile* 2>&1 >/dev/null ; deno test -A --unstable --coverage=cov_profile',
    },

    coverage: {
      cmd: 'deno coverage --unstable cov_profile --exclude="test-hooks"',
    },

    lint: {
      cmd: "find ./ -iname '*.ts' -type f -print0 | xargs --null -i  bash -c 'deno lint --unstable {}'",
    },

    update: {
      cmd: `deno run -A --unstable ./src/modules/update-modules/mod.ts ./src`,
    },

    installDeps: {
      cmd: 'deno install -A -f -n udd https://deno.land/x/udd/main.ts',
    },
  },
}
