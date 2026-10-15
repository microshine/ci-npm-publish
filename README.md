# ci-npm-publish

Небольшой TypeScript-модуль для обкатки ведения и публикации npm-пакета через GitHub Actions.
Пакет: **`@microshine/ci-npm-publish`**, реестр: **`https://npm.pkg.github.com`** (GitHub Packages).

Процесс основан на CI в `pvtsutils`: общие проверки, PR с новой версией, публикация после слияния,
теги и GitHub Release. Список изменений из заголовков слитых PR с Angular preset попадает в описание релизного PR;
после слияния этот текст переносится в GitHub Release. Отдельный файл с историей изменений не ведётся.
Для публикации используется встроенный `GITHUB_TOKEN` с правом `packages: write`.

## Модуль

Две простые функции: `greet` для одного имени и `greetMany` для списка имён.
Сборка ESM, с TypeScript-декларациями, без зависимостей времени выполнения.

```ts
import { greet, greetMany } from "@microshine/ci-npm-publish";

greet(); // "Hello, world!"
greet("microshine"); // "Hello, microshine!"
greet("CI", { prefix: "Hi" }); // "Hi, CI!"
greet("CI", { suffix: "." }); // "Hello, CI."
greet("CI", { suffix: "" }); // "Hello, CI"
greet(undefined, { fallbackName: "team" }); // "Hello, team!"
greetMany(["microshine", "CI"]); // ["Hello, microshine!", "Hello, CI!"]
greetMany(["CI", " "], { prefix: "Hi" }); // ["Hi, CI!", "Hi, world!"]
greetMany(["CI", " "], { prefix: "Hi", suffix: ".", fallbackName: "team" });
// ["Hi, CI.", "Hi, team."]
```

Имена, префикс и `fallbackName` очищаются от пробелов по краям. Отсутствующее или пустое имя заменяется
на `fallbackName` (по умолчанию `world`); пустой `fallbackName` также заменяется на `world`.
Пустой префикс заменяется на `Hello`. `suffix` добавляется после имени без изменений: по умолчанию `!`,
пустая строка убирает знак в конце, а пробелы сохраняются — например, `suffix: " 👋"`.
`greetMany` применяет одни и те же настройки ко всем именам, сохраняет порядок и не изменяет исходный список;
пустой список возвращает `[]`.

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
`src/index.spec.ts` содержит тесты модуля, `.github/scripts/pr-release-notes.spec.mjs` — тесты генерации
из заголовков PR, `.github/scripts/release-notes.spec.mjs` — тесты подготовки и переноса release notes.
`build/` и `coverage/` генерируются и не коммитятся.
Сборка через tsdown проверяет типы/экспорты пакета с помощью Are the Types Wrong.
Если сборка обновила поля экспортов в `package.json`, включи их в коммит: CI проверяет отсутствие таких изменений.

## CI и релизы

| Workflow         | Когда запускается                                       | Что делает                                                                        |
| ---------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Test**         | PR и push в `main`                                      | Lint, типы, одна сборка, unit-тесты, упаковка и проверки установленного `.tgz`    |
| **Version Bump** | Вручную из Actions, ветка `main`                        | `patch` / `minor` / `major`, PR `release/version-bump` с release notes в описании |
| **Publish**      | Изменение `package.json` в `main` или вручную на `main` | Проверки, GitHub Packages, тег `vX.Y.Z`, обновление тега `vX`, GitHub Release     |

Проверки вынесены в `.github/actions/verify`. Coveralls и npm Trusted Publisher для этого стенда не нужны.

### Проверка пакета на заявленных версиях Node

Диапазон `engines.node` — `>=24`. В одной job через `actions/setup-node` последовательно проверяются:

- **24.0.0** — точная нижняя граница;
- **24** — последняя версия ветки 24;
- **25** — последняя версия ветки 25;
- **26** — последняя версия ветки 26.

На каждом запуске Test или Publish сборка и упаковка выполняются один раз. Во всех проверках используется
один и тот же `.tgz`; его SHA-512 сверяется перед каждой установкой. Для каждой версии Node создаётся новый
временный проект, в который устанавливается только пакет из архива с `--engine-strict` и без devDependencies
репозитория. Проверяется загрузка через ESM `import` и CommonJS `require`, поведение `greet` / `greetMany`,
версия пакета, `engines` и наличие деклараций TypeScript.

После проверок восстанавливается Node 24. Publish дополнительно сверяет SHA-512 и передаёт проверенный архив
в `npm publish <tarball> --ignore-scripts`; повторной сборки или упаковки перед публикацией нет.
Ошибки совместимости блокируют публикацию. Версии задаются в `.github/actions/verify/action.yml`:
при изменении `engines` или появлении новой major-версии Node обновляй этот список.

### Настройка GitHub один раз

1. В **Settings → Actions → General** разреши GitHub Actions и используемые actions.
2. В **Workflow permissions** включи **Allow GitHub Actions to create and approve pull requests**, чтобы
   Version Bump мог открывать PR. Права токена для каждого workflow уже указаны в YAML.
3. По желанию добавь repository secret **`RELEASE_TOKEN`** — PAT или токен GitHub App с правами
   на содержимое репозитория и PR. Он нужен только для автоматического запуска CI на PR, созданном ботом.
   При использовании встроенного `GITHUB_TOKEN` GitHub может потребовать **Approve workflows to run** на таком PR.

`NPM_TOKEN`, OIDC и отдельный environment для публикации не требуются. Registry закреплён и в
`publishConfig`, и в `.npmrc`; scope совпадает с владельцем репозитория (`microshine`).

### История релизов

История изменений хранится в [GitHub Releases](https://github.com/microshine/ci-npm-publish/releases).
Релизы `v0.1.0` и `v0.2.0` уже опубликованы. Новые версии выпускаются через **Version Bump** и слияние релизного PR.

Пакет доступен в разделе **Packages**. По умолчанию новый пакет имеет private visibility;
при необходимости измени её в настройках пакета. Связь с этим репозиторием задаётся полем `repository` в `package.json`.

### Следующие релизы

1. Измени `greet`, добавь тест и отправь PR, например с заголовком `feat: add a greeting option`.
2. Дождись **Test** и слей PR в `main`.
3. Запусти **Actions → Version Bump → Run workflow**, выбери `main` и тип повышения версии.
4. Проверь созданный PR: версии в `package.json` / `package-lock.json` и раздел **Release notes** в описании PR.
   При необходимости отредактируй заметки, дождись **Test** и слей PR в `main`.
5. **Publish** повторно проверит код, опубликует новую версию в GitHub Packages и перенесёт проверенные заметки
   из описания слитого PR в GitHub Release.

Release notes формируются **из заголовков слитых PR**. В них попадают PR в `main`, чей merge-коммит,
squash-коммит или последний коммит после rebase находится между предыдущим тегом `vX.Y.Z` и текущим `HEAD`.
До первого тега рассматривается вся история; перемещаемый тег `vX` не используется.
Заголовки обрабатываются тем же Angular preset, который раньше использовался для коммитов:

| Пример заголовка PR                         | Раздел release notes                      |
| ------------------------------------------- | ----------------------------------------- |
| `feat: add a greeting option`               | Features                                  |
| `fix(parser): handle blank names`           | Bug Fixes, с указанием scope `parser`     |
| `perf: cache greetings`                     | Performance Improvements                  |
| `revert: remove a greeting option`          | Reverts                                   |
| `feat(api)!: change the greeting signature` | Features и BREAKING CHANGES               |
| `ci!: require Node.js 24`                   | Continuous Integration и BREAKING CHANGES |
| `ci:`, `docs:`, `chore:` без `!`            | Не включаются                             |

Каждая запись содержит ссылку на PR. Неслитые PR, PR в другие ветки, уже выпущенные изменения и коммиты
без PR не включаются. Тело PR не используется: несовместимое изменение отметь `!` перед двоеточием в заголовке.
Если все PR отфильтрованы или PR нет, добавь описание вручную в раздел **Release notes** релизного PR:
публикация останавливается при пустых заметках. Тип повышения версии выбирается вручную.

Для локальной генерации нужны полная история с тегами, [GitHub CLI](https://cli.github.com/) и авторизация
через `gh auth login` или `GH_TOKEN` с правом чтения PR:

```bash
git fetch --tags
npm version patch --no-git-tag-version
npm run --silent changelog
```

Команда выводит release notes в stdout. Репозиторий берётся из `GITHUB_REPOSITORY` или поля `repository.url`
в `package.json`; ветка по умолчанию — `main` (можно задать `RELEASE_BASE_BRANCH`).
Генератор завершится с ошибкой, если версия уже имеет тег: сначала повысь версию пакета.

Заметки находятся между скрытыми HTML-маркерами в описании PR. При редактировании сохраняй эти строки:

```markdown
<!-- release-notes:v0.3.0 -->

### Features

- Описание изменений, которое попадёт в GitHub Release.

<!-- /release-notes -->
```

Версия в начальном маркере должна совпадать с версией пакета. Publish копирует только текст между маркерами,
без служебных инструкций PR, и не генерирует заметки заново. При отсутствующих или повторяющихся маркерах
либо пустом тексте публикация останавливается до отправки пакета. Повторный запуск Version Bump обновляет описание PR;
ручные правки заметок вноси после последнего запуска.

При сбое повтори неуспешный запуск через **Re-run failed jobs**. Публикация пропускает уже существующую
версию пакета и завершает создание тегов/Release. При существующем GitHub Release весь релиз пропускается.
Publish получает релизный PR по коммиту его слияния и ожидает ветку `release/version-bump` с базой `main`.
Для восстановления частичного релиза используй исходный запуск: он сохраняет нужный коммит и связь с PR.
Ручной **Publish → Run workflow → main** подходит, пока `main` указывает на коммит слияния релизного PR;
если после него появились другие коммиты, повтори исходный запуск Publish.
Уже опубликованные версии не меняются; для следующего эксперимента повышай версию.

### Сценарий обкатки с несколькими коммитами

1. Создай PR с несколькими коммитами и заголовком `feat: add a greeting option`.
   На PR запускается **Test**; **Publish** запускается после изменения версии в `main`.
2. Слей PR через merge, squash или rebase. Во всех случаях источником заметки служит заголовок PR.
   Для проверки фильтрации отдельно слей PR с заголовком `docs: update greeting examples`.
3. Запусти **Version Bump** с `minor` для новых функций или с `patch` для исправлений.
   В описании релизного PR проверь release notes: PR с `feat:` должен попасть в них одной записью со ссылкой,
   PR с `docs:` — нет.
4. После слияния релизного PR проверь новую версию в **Packages**, теги и GitHub Release.
   Если используется `GITHUB_TOKEN`, подтверди запуск CI на созданном ботом релизном PR, когда GitHub попросит.

Описание API выше относится к текущему исходному коду. После слияния функциональных изменений нужен отдельный
Version Bump и релиз, чтобы новые функции появились в устанавливаемом пакете.

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
