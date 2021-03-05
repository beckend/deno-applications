# Tasks For My Project

## prepare

> prepares for development

~~~bash
deno install -A -f -n udd https://deno.land/x/udd/main.ts
~~~


## update

> updates project

~~~bash
deno run -A --unstable ./src/modules/update-modules/mod.ts ./src
~~~


## test

> tests

~~~bash
rm -rf ./cov_profile* 2>&1 >/dev/null ; deno test -A --unstable --no-check --coverage=cov_profile
~~~

## test:coverage

> code coverage

~~~bash
deno coverage --unstable cov_profile --exclude="test-hooks"
~~~

## lint

> lint code

~~~bash
find ./ -iname '*.ts' -type f -print0 | xargs --null -i  bash -c 'deno lint --unstable {}'
~~~


