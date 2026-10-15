# ci-npm-publish

Небольшой TypeScript-модуль для обкатки ведения и публикации npm-пакета через GitHub Actions.
Пакет: **`@microshine/ci-npm-publish`**, реестр: **`https://npm.pkg.github.com`** (GitHub Packages).

Процесс повторяет переход `pvtsutils` на [release-please в PR #41](https://github.com/PeculiarVentures/pvtsutils/pull/41):
Conventional Commits → релизный PR → тег и GitHub Release → публикация npm-пакета.
Версия определяется автоматически, заметки хранятся в GitHub Releases; `CHANGELOG.md` не создаётся.
Для публикации используется встроенный `GITHUB_TOKEN` с правом `packages: write`.

## Модуль

Три функции: `greet` для одного имени, `greetMany` для списка имён и `createGreeter` для повторного использования настроек.
Сборка ESM, с TypeScript-декларациями, без зависимостей времени выполнения.

```ts
import { createGreeter, greet, greetMany } from "@microshine/ci-npm-publish";

greet(); // "Hello, world!"
greet("microshine"); // "Hello, microshine!"
greet("CI", { prefix: "Hi" }); // "Hi, CI!"
greet("CI", { suffix: "." }); // "Hello, CI."
greet("CI", { suffix: "" }); // "Hello, CI"
greet("CI", { prefix: "Hi", separator: ": " }); // "Hi: CI!"
greet("CI", { separator: "" }); // "HelloCI!"
greet(undefined, { fallbackName: "team" }); // "Hello, team!"
greetMany(["microshine", "CI"]); // ["Hello, microshine!", "Hello, CI!"]
greetMany(["CI", " "], { prefix: "Hi" }); // ["Hi, CI!", "Hi, world!"]
greetMany(["CI", " "], { prefix: "Hi", suffix: ".", fallbackName: "team" });
// ["Hi, CI.", "Hi, team."]

const welcome = createGreeter({ prefix: "Welcome", separator: ": ", fallbackName: "team" });
welcome("CI"); // "Welcome: CI!"
welcome(); // "Welcome: team!"
```

Имена, префикс и `fallbackName` очищаются от пробелов по краям. Отсутствующее или пустое имя заменяется
на `fallbackName` (по умолчанию `world`); пустой `fallbackName` также заменяется на `world`.
Пустой префикс заменяется на `Hello`. `suffix` добавляется после имени без изменений: по умолчанию `!`,
пустая строка убирает знак в конце, а пробелы сохраняются — например, `suffix: " 👋"`.
`separator` задаёт текст между префиксом и именем: по умолчанию `", "`; пустая строка и пробелы сохраняются.
`greetMany` применяет одни и те же настройки ко всем именам, сохраняет порядок и не изменяет исходный список;
пустой список возвращает `[]`. Пропуски в разреженном массиве получают приветствие с `fallbackName`.
Унаследованные числовые свойства не заполняют пропуски: учитываются только собственные элементы массива.
Префикс и резервное имя нормализуются один раз на весь список.

`createGreeter` сохраняет настройки в момент создания функции и использует их для всех последующих вызовов.
Изменение исходного объекта настроек не меняет готовую функцию. Имена очищаются от пробелов при каждом вызове;
отсутствующее или пустое имя использует сохранённый `fallbackName`.

Например, одна фабрика подходит для нескольких независимых списков имён:

```ts
const options = { prefix: "Hi", separator: ": ", suffix: ".", fallbackName: "team" };
const greeting = createGreeter(options);
options.prefix = "Welcome";

["CI", " "].map(greeting); // ["Hi: CI.", "Hi: team."]
greeting(); // "Hi: team."
```

Для разовой обработки списка используй `greetMany`; для отдельных вызовов с одинаковыми настройками —
`createGreeter`. В обоих случаях начало приветствия готовится один раз для выбранных настроек.

## Локальная разработка

Node.js 24 или новее. CI собирает пакет на Node.js 24 и проверяет установленный архив на нескольких версиях Node.

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run coverage
npm run --silent package:pack
npm run package:check -- /absolute/path/from-pack-output.tgz
```

`package:pack` выводит JSON с полями `tarball` (полный путь к `.tgz`) и `integrity` (SHA-512).
Он упаковывает уже собранный `build/` с `--ignore-scripts`, поэтому не вызывает `prepack` и повторную сборку.
Подставь путь из `tarball` в `package:check`; вторым аргументом можно передать `integrity`.
Проверка создаёт временный проект-потребитель, устанавливает архив и запускает тесты через `node:test`.

`npm run format` и `npm run lint:fix` исправляют оформление и замечания линтера.
`src/index.spec.ts` содержит тесты модуля, `.github/fixtures/package-consumer.test.mjs` — проверки установленного пакета.
`build/` и `coverage/` генерируются и не коммитятся.
Сборка через tsdown проверяет типы/экспорты пакета с помощью Are the Types Wrong.
Если сборка обновила поля экспортов в `package.json`, включи их в коммит: CI проверяет отсутствие таких изменений.

## CI и релизы

| Workflow    | Когда запускается                                 | Что делает                                                                                                                                   |
| ----------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test**    | PR и push в `main`                                | Lint, форматирование, типы, сборка, тесты с coverage, упаковка и проверки установленного `.tgz`                                              |
| **Publish** | Каждый push в `main` или вручную из тега `vX.Y.Z` | release-please готовит PR или создаёт релиз; после создания релиза выполняются проверки, публикация в GitHub Packages и обновление тега `vX` |

В **Publish** три job: `check` → `release-please` → `publish`. Сначала `check` проверяет коммит,
поэтому код с ошибками не получает релизный тег или GitHub Release. После создания релиза запускается публикация.
При ручном запуске из релизного тега первые две job пропускаются, а `publish` повторяет проверки и публикацию.
Общие проверки вынесены в `.github/actions/verify`.

### Как выпускается новая версия

1. Отправь изменение через PR с Conventional Commit в заголовке, например `feat: add a greeting option`.
   Для предсказуемых release notes используй squash merge: заголовок PR станет сообщением коммита в `main`.
2. После слияния **Publish** запускает release-please, который открывает или обновляет один
   PR `chore(release): vX.Y.Z`. В PR меняются `package.json`, `package-lock.json`
   и `.release-please-manifest.json`; заметки находятся в описании PR.
3. Проверь версию и заметки, дождись **Test** и слей релизный PR в `main`.
4. После успешной `check` release-please создаст тег `vX.Y.Z` и GitHub Release. Job `publish` сверит SHA
   релиза с `GITHUB_SHA`, повторно проверит этот коммит, опубликует проверенный архив в GitHub Packages
   и переместит тег `vX`, если выпускаемая версия — последняя в своей major-ветке.
5. Проверь **Actions → Publish**, новую версию в **Packages**, теги и
   [GitHub Release](https://github.com/microshine/ci-npm-publish/releases).

Конфигурация в `release-please-config.json` повторяет PR #41: стратегия `node`, теги `vX.Y.Z`
без имени компонента, `skip-changelog: true` и те же разделы заметок.
Ветка стенда — `main`, пакет — `@microshine/ci-npm-publish`, реестр — GitHub Packages.
При переходе manifest начинался с `0.2.2`; далее release-please обновляет его вместе с версиями в `package.json`
и `package-lock.json`. Следующую версию определяют изменения после последнего релиза.

| Коммит в `main`                                       | Повышение версии                 | Раздел release notes                   |
| ----------------------------------------------------- | -------------------------------- | -------------------------------------- |
| `feat: ...`                                           | minor                            | Features                               |
| `fix: ...`                                            | patch                            | Bug Fixes                              |
| `perf: ...`                                           | patch                            | Performance Improvements               |
| `build: ...`                                          | patch                            | Build System                           |
| `revert: ...`                                         | patch                            | Reverts                                |
| `feat!: ...` или footer `BREAKING CHANGE: ...`        | major                            | BREAKING CHANGES и раздел типа коммита |
| `ci:`, `docs:`, `chore:`, `test:` без breaking change | Самостоятельно не вызывают релиз | Не включаются                          |

Для явного выбора версии добавь `Release-As: x.y.z` в тело коммита, который попадёт в `main`.
release-please группирует историю по слитым PR. При обычном merge сообщения внутренних коммитов
не гарантируют отдельные записи: учитывается сообщение слияния, в котором GitHub обычно сохраняет заголовок PR.
Для предсказуемой записи используй squash с Conventional Commit из заголовка PR; для нескольких записей
в одном PR задай блок переопределения, описанный ниже.

release-please обновляет описание релизного PR при новых изменениях, поэтому ручные правки могут быть перезаписаны.
Чтобы исправить заметку для уже слитого изменения, добавь в описание исходного PR блок
`BEGIN_COMMIT_OVERRIDE` … `END_COMMIT_OVERRIDE` с исправленным сообщением Conventional Commit.
Несколько сообщений разделяй пустой строкой. Блок читается из исходного слитого PR при следующем запуске release-please.
Метки `autorelease: pending` / `autorelease: tagged` управляются release-please; если процесс застрял,
проверь незавершённые релизные PR и их метки.

### Проверка пакета на заявленных версиях Node

Диапазон `engines.node` — `>=24`. В одной job через `actions/setup-node` последовательно проверяются:

- **24.0.0** — точная нижняя граница;
- **24** — последняя версия ветки 24;
- **25** — последняя версия ветки 25;
- **26** — последняя версия ветки 26.

В каждой job с `verify` сборка и упаковка выполняются один раз. Во всех проверках этой job используется один `.tgz`;
его SHA-512 сверяется перед каждой установкой. Для каждой версии Node создаётся временный проект,
в который устанавливается архив с `--engine-strict` без devDependencies репозитория. Проверяются
ESM `import`, CommonJS `require`, функции модуля, версия, `engines` и декларации TypeScript.

После проверок восстанавливается Node 24. Publish дополнительно сверяет SHA-512 и передаёт архив
в `npm publish <tarball> --ignore-scripts --registry=https://npm.pkg.github.com`.
Ошибки проверок блокируют публикацию. Версии Node задаются в `.github/actions/verify/action.yml`.

### Настройка GitHub один раз

1. В **Settings → Actions → General** разреши GitHub Actions и используемые actions.
2. В **Workflow permissions** включи **Allow GitHub Actions to create and approve pull requests**.
   Права `contents: write`, `issues: write` и `pull-requests: write` для release-please уже указаны в YAML.
3. Для автоматического запуска **Test** на релизном PR добавь repository secret **`RELEASE_TOKEN`** —
   PAT или токен GitHub App с доступом к содержимому, issues и PR этого репозитория.
   Без него release-please использует `GITHUB_TOKEN`, а созданный или обновлённый ботом PR не запускает **Test** автоматически.
4. Для публикации используется `GITHUB_TOKEN` с `packages: write`. Если пакет уже существует и не наследует
   доступ репозитория, предоставь этому репозиторию доступ в **Package settings → Manage Actions access**.

`NPM_TOKEN`, OIDC и отдельный environment для публикации не требуются. Registry закреплён в
`publishConfig` и `.npmrc`; scope совпадает с владельцем репозитория (`microshine`).
Связь пакета с репозиторием задаётся полем `repository` в `package.json`.

### Повтор неудачной публикации

Если `check` упала, release-please не создаёт релиз. Если упала `publish`, тег и GitHub Release уже существуют:
используй **Re-run failed jobs** либо запусти **Publish** вручную из точного релизного тега.
Ручной запуск из `main` или другой ветки отклоняется. Через GitHub CLI:

```bash
gh workflow run publish.yml --ref vX.Y.Z
```

Вместо `vX.Y.Z` укажи существующий тег. В ручном запуске версия из `package.json` должна совпадать с тегом;
в автоматическом SHA от release-please должен совпадать с `GITHUB_SHA`.
Сборка использует коммит события без переключения на другой коммит.

Уже опубликованная версия пропускается. Только ответ `E404` от реестра разрешает новую публикацию;
ошибки авторизации или сети останавливают job. Повтор старой версии не откатывает тег `vX`:
он обновляется только для последнего стабильного тега этой major-ветки.
Наличие GitHub Release само по себе не означает, что npm-пакет уже опубликован.

### Если release-please пропустил слитый стек

При слиянии всего стека одним итоговым PR release-please может увидеть только сообщение этого PR.
Если оно начинается с `docs:`, запуск завершается успешно с `No user facing commits found`,
даже когда среди внутренних коммитов есть `feat`, `fix` и `perf`.

Так произошло со стеком #17–#20: итоговое слияние получило сообщение PR #20 с типом `docs`,
а GitHub связал этот merge-коммит с PR #17, открытым в `main`. Для восстановления блок добавлен
в описание связанного PR #17. Связь определяется через API `commits/<merge-sha>/pulls`;
номер в тексте merge-коммита может указывать на другой PR стека.

```text
BEGIN_COMMIT_OVERRIDE
feat(greetings): add reusable greeting factories (#17)

fix(greetings): keep inherited values out of sparse greetings (#18)

perf(greetings): reuse precomputed greeting openings (#19)
END_COMMIT_OVERRIDE
```

Затем повтори исходный **Publish**, который запускался по `push` в `main`, через **Re-run all jobs**
или GitHub CLI, подставив ID того запуска:

```bash
gh run rerun <push-run-id> --repo microshine/ci-npm-publish
```

Этот повтор заново запускает `check` и release-please, который подготовит релизный PR.
После его слияния пакет публикуется автоматически. Для ручного повтора публикации через **Run workflow**
выбери существующий релизный тег.

### Сценарий обкатки

1. Слей PR с `feat:`, затем PR с `fix:` и PR с `docs:` через squash merge.
2. Проверь, что release-please обновляет один релизный PR: `feat` даёт minor,
   `feat` и `fix` попадают в заметки, `docs` не появляется.
3. Слей релизный PR и проверь успешные **Test** / **Publish**, GitHub Release, точный тег `vX.Y.Z`,
   перемещаемый тег `vX` и опубликованную версию в GitHub Packages.
4. Повтори **Publish** вручную из тега выпущенной версии: существующий пакет должен быть пропущен.
   Запуск из `main` должен завершиться понятной ошибкой. После следующего релиза повтори старый тег:
   перемещаемый тег `vX` должен остаться на новой версии.
5. Установи выпущенную версию в отдельный проект-потребитель по инструкции ниже и проверь API.

### Готовый стек PR для проверки Conventional Commits

| Порядок | PR                                                                                                         | Коммиты в самом PR        | Ожидаемый раздел release notes |
| ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------ |
| 1       | [#17 — фабрика приветствий](https://github.com/microshine/ci-npm-publish/pull/17)                          | 3: `feat`, `test`, `docs` | Features                       |
| 2       | [#18 — унаследованные элементы разреженного массива](https://github.com/microshine/ci-npm-publish/pull/18) | 2: `fix`, `test`          | Bug Fixes                      |
| 3       | [#19 — подготовка начала приветствия один раз](https://github.com/microshine/ci-npm-publish/pull/19)       | 1: `perf`                 | Performance Improvements       |
| 4       | `docs(releases): document the release-please trial stack` — этот документ                                  | 2: `docs`, `docs`         | Не включается                  |

Стек начинается от `main`; каждый следующий PR открыт в ветку предыдущего, поэтому его diff показывает
только собственное изменение. Сливай каждый PR непосредственно в `main`, по порядку:

1. Дождись **Test** на #17 и слей его в `main` через **Create a merge commit**.
2. Переключи base #18 на `main`, проверь diff и **Test**, затем слей его таким же способом.
   Повтори это для #19 и последнего PR с документацией. Каждый тип изменения должен попасть в `main`
   отдельным PR, чтобы release-please учёл их независимо. Если весь стек сливается одним итоговым PR,
   добавь в его описание блок переопределения из предыдущего раздела.
3. Если используешь **Squash and merge** или **Rebase and merge**, сначала перенеси оставшиеся ветки стека
   через rebase на новый `main`, сохраняя только их собственные коммиты, и обнови PR. Иначе исходные коммиты
   предыдущих PR могут повторно попасть в историю и release notes. При squash используй Conventional Commit из заголовка PR.
4. До завершения стека не сливай автоматически обновляемый релизный PR release-please.
   После всех четырёх PR проверь по одной записи из этого стека в **Features**, **Bug Fixes**
   и **Performance Improvements**. Отдельные записи для `test` и `docs` должны отсутствовать; общий bump — minor
   относительно последнего релиза. Другие невыпущенные изменения могут добавить свои записи.
5. Слей релизный PR, дождись **Publish** и проверь новую версию в GitHub Packages, точный тег,
   major-тег и GitHub Release. Установи пакет в отдельный проект и проверь:

```js
import assert from "node:assert/strict";
import { createGreeter, greetMany } from "@microshine/ci-npm-publish";

const options = { prefix: "Hi", separator: ": ", fallbackName: "team" };
const greeting = createGreeter(options);
options.prefix = "Welcome";
assert.equal(greeting("CI"), "Hi: CI!");
assert.equal(greeting(), "Hi: team!");

const names = [, "CI"];
const prototype = Object.create(Array.prototype);
Object.defineProperty(prototype, "0", { value: "inherited" });
Object.setPrototypeOf(names, prototype);
assert.deepEqual(greetMany(names, { fallbackName: "team" }), ["Hello, team!", "Hello, CI!"]);
```

Повторный **Publish** запускай из выпущенного тега: существующая версия пакета должна быть пропущена.
Отдельный будущий PR только с `docs` или `test` не должен самостоятельно открывать релизный PR.

## Установка из GitHub Packages

Для локальной установки нужен **personal access token (classic)** с правом **`read:packages`** и доступом к пакету,
в том числе если пакет публичный. Выполни в проекте, куда устанавливаешь модуль:

```bash
npm login --scope=@microshine --auth-type=legacy --registry=https://npm.pkg.github.com
# Username: GitHub username; Password: PAT classic
npm install @microshine/ci-npm-publish
```

В `.npmrc` проекта-потребителя должно быть сопоставление scope (в этом репозитории оно уже есть):

```ini
@microshine:registry=https://npm.pkg.github.com
```

Токен хранится в пользовательской конфигурации npm; не добавляй его в репозиторий.
Для установки в другом GitHub Actions workflow можно использовать его `GITHUB_TOKEN` с `packages: read`,
если в настройках пакета этому репозиторию предоставлен доступ через **Manage Actions access**.

Документация GitHub: [npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
и [запуск workflows из workflows](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
