# ci-npm-publish

Небольшой TypeScript-модуль для обкатки ведения и публикации npm-пакета через GitHub Actions.
Пакет: **`@microshine/ci-npm-publish`**, реестр: **`https://npm.pkg.github.com`** (GitHub Packages).

Процесс повторяет CI в `pvtsutils`: общие проверки, PR с новой версией и changelog, публикация после слияния,
теги и GitHub Release. Для публикации используется встроенный `GITHUB_TOKEN` с правом `packages: write`.

## Модуль

Единственная функция — `greet`. Сборка ESM, с TypeScript-декларациями, без зависимостей времени выполнения.

```ts
import { greet } from "@microshine/ci-npm-publish";

greet(); // "Hello, world!"
greet("microshine"); // "Hello, microshine!"
```

## Локальная разработка

Node.js 24 или новее; CI использует Node.js 24.

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run coverage
npm pack --dry-run
```

`npm run format` и `npm run lint:fix` исправляют оформление и замечания линтера.
`src/index.spec.ts` содержит тесты; `build/` и `coverage/` генерируются и не коммитятся.
Сборка через tsdown проверяет типы/экспорты пакета с помощью Are the Types Wrong.
Если сборка обновила поля экспортов в `package.json`, включи их в коммит: CI проверяет отсутствие таких изменений.

## CI и релизы

| Workflow         | Когда запускается                                       | Что делает                                                                    |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Test**         | PR и push в `main`                                      | Установка, lint, форматирование, типы, сборка, тесты с покрытием              |
| **Version Bump** | Вручную из Actions, ветка `main`                        | `patch` / `minor` / `major`, changelog, PR `release/version-bump`             |
| **Publish**      | Изменение `package.json` в `main` или вручную на `main` | Проверки, GitHub Packages, тег `vX.Y.Z`, обновление тега `vX`, GitHub Release |

Проверки вынесены в `.github/actions/verify`. Coveralls и npm Trusted Publisher для этого стенда не нужны.

### Настройка GitHub один раз

1. В **Settings → Actions → General** разреши GitHub Actions и используемые actions.
2. В **Workflow permissions** включи **Allow GitHub Actions to create and approve pull requests**, чтобы
   Version Bump мог открывать PR. Права токена для каждого workflow уже указаны в YAML.
3. По желанию добавь repository secret **`RELEASE_TOKEN`** — PAT или токен GitHub App с правами
   на содержимое репозитория и PR. Он нужен только для автоматического запуска CI на PR, созданном ботом.
   При использовании встроенного `GITHUB_TOKEN` GitHub может потребовать **Approve workflows to run** на таком PR.

`NPM_TOKEN`, OIDC и отдельный environment для публикации не требуются. Registry закреплён и в
`publishConfig`, и в `.npmrc`; scope совпадает с владельцем репозитория (`microshine`).

### Первый релиз

В проекте уже подготовлены версия **0.1.0** и соответствующий раздел `CHANGELOG.md`.
Закоммить файлы и отправь их в `main`: изменение `package.json` запустит **Publish**, который опубликует
`@microshine/ci-npm-publish@0.1.0`, создаст теги `v0.1.0` / `v0` и GitHub Release.
Если файлы попали в `main` без запуска workflow, запусти **Publish → Run workflow → main** вручную.

После первой публикации пакет появится в разделе **Packages**. По умолчанию новый пакет имеет private visibility;
при необходимости измени её в настройках пакета. Связь с этим репозиторием задаётся полем `repository` в `package.json`.

### Следующие релизы

1. Измени `greet`, добавь тест и отправь PR, например с заголовком `feat: add a greeting option`.
2. Дождись **Test** и слей PR в `main`.
3. Запусти **Actions → Version Bump → Run workflow**, выбери `main` и тип повышения версии.
4. Проверь созданный PR: `package.json`, `package-lock.json` и `CHANGELOG.md`. Слей его после проверок.
5. **Publish** повторно проверит код и опубликует новую версию в GitHub Packages.

Используй Conventional Commits: `feat:`, `fix:`, `perf:` и `BREAKING CHANGE:` попадают в changelog
с Angular preset. Если релиз содержит только `ci:` / `docs:` / `chore:`, добавь описание вручную в новый раздел
changelog в релизном PR: публикация останавливается при пустых release notes.
Тип повышения версии выбирается вручную, а не вычисляется из коммитов.

При сбое повтори неуспешный запуск через **Re-run failed jobs**. Публикация пропускает уже существующую
версию пакета и завершает создание тегов/Release. При существующем GitHub Release весь релиз пропускается.
Для восстановления частичного релиза используй исходный запуск: тег версии должен указывать на его коммит.
Уже опубликованные версии не меняются; для следующего эксперимента повышай версию.

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
