# Plan: migrate setup-air to ESM

Status: proposed. Verified by a local proof of concept (POC), see "Verification
already done" at the end.

## Background

`npm run all` fails at `npm run package` (ncc) since commit `f84d7e8` ("Bump
@actions/core from 1.11.1 to 3.0.1"):

```
Error: Module not found: Error: Package path . is not exported from package
node_modules/@actions/core (see exports field in node_modules/@actions/core/package.json)
```

`@actions/core@3` is ESM-only:

```json
"type": "module",
"exports": { ".": { "types": "./lib/core.d.ts", "import": "./lib/core.js" } }
```

The repo compiles TypeScript to CommonJS (`"module": "commonjs"`), so ncc 0.38 /
webpack resolves `import * as core from "@actions/core"` as a `require`. No
`require` / `default` condition exists, so resolution fails. `tsc` doesn't
notice: `module: commonjs` implies legacy `node10` resolution, which ignores
`exports`. The `@octokit/*` packages are already ESM-only too, but they still
work today only because they also export a `"default"` condition.

Note: on `main`, `package.json`/`package-lock.json` are on core v3, but the
committed `dist/setup-air/index.js` is still the old core v1 bundle (the
Dependabot PR never rebuilt it). So the published action still works, but the
`test-hygiene` CI job fails.

The rest of the `@actions/*` toolkit is going the same way
(`@actions/tool-cache@4`, `exec@3`, `io@3`, `http-client@4` are all
`"type": "module"` with import-only exports). Pinning back to core v1 would only
delay this, so we migrate.

## Decisions

  | Topic                 | Decision                                                                | Alternatives considered                 |
  | ---                   | ---                                                                     | ---                                     |
  | Package type          | `"type": "module"`                                                      | n/a                                     |
  | TS module resolution  | `module: esnext` + `moduleResolution: bundler`                          | `nodenext`                              |
  | Type checking         | `tsc --noEmit` (no `lib/` output)                                       | n/a                                     |
  | Bundler               | esbuild via `scripts/build-dist.mjs`                                    | ncc 0.45, rollup                        |
  | Shipped bundle format | CommonJS, `dist/setup-air/index.cjs`                                    | ESM `index.js` + `createRequire` banner |
  | Toolkit versions      | `@actions/core@^3`, `@actions/tool-cache@^4`                            | keep tool-cache 2                       |
  | Extras                | remove unused devDeps, `lib/` cleanup, `npm ci` in CI, Dependabot group | unit tests (separate PR)                |

### Why `bundler` over `nodenext`

Both were tested and produce **byte-identical** `dist` bundles, and both pass
the runtime matrix. `bundler` wins for this repo because:

- `tsc` is only a type checker here (`--noEmit`). The code is never executed as
  tsc output by Node, it is always resolved by esbuild. `bundler` resolution
  models exactly that: `exports` conditions are honored, and relative imports
  don't need extensions.
- No source changes. `nodenext` requires rewriting 6 relative imports to
  `./foo.js` (pointing at files that never exist).
- It matches the sibling actions this repo was derived from:
  - astral-sh/ruff-action (#345, "Migrate to ESMBundler and node 24"): `esnext` +
    `bundler`, esbuild, `.cjs` output.
  - astral-sh/setup-uv (#806, "Switch to ESM for source and test, use CommonJS
    for dist"): it was on `nodenext` + ncc before and moved **to** `bundler` +
    esbuild.
  - biomejs/setup-biome: `ESNext` + `bundler` (built by bun to
    `dist/index.mjs`).
- `actions/typescript-action` (the official template) uses `NodeNext` + rollup +
  ESM output. That's a reasonable choice when tsc output is meant to be runnable
  directly, but that isn't our situation.

`isolatedModules` + `verbatimModuleSyntax` are enabled because esbuild compiles
each file in isolation. These flags make tsc flag anything esbuild can't handle
(e.g. type-only imports without `type`). The current source already complies.

### Why esbuild with CJS output

- **Plain ESM output is broken.** An esbuild `format: "esm"` bundle crashes at
  load: `Error: Dynamic require of "net" is not supported`, from `tunnel` (still
  CJS, used by `@actions/http-client`). `undici` also does ~100
  `require("node:*")` calls. ESM output only works with a hand-written
  `createRequire` banner. setup-uv's AGENTS.md records the same conclusion:
  "`dist/` should prioritize runtime reliability over format purity."
- **The file must be `.cjs`.** With `"type": "module"`, Node treats every `.js`
  file under the repo as ESM. Verified: the current ncc-built CJS
  `dist/setup-air/index.js` crashes in the POC tree with
  `ReferenceError: __dirname is not defined in ES module scope`. `action.yml`'s
  `main` must change, and the old `index.js` must be deleted (the build script
  does this).
- esbuild picks the export condition by *import kind* (an `import` statement
  uses the `import` condition) independent of output format, so ESM-only deps
  bundle fine into CJS.
- ncc 0.45 also works (it emits ESM with a `createRequire` shim and writes
  `dist/.../package.json`). But it runs its own TS compile, so under TS 6 it
  needs `rootDir` and can't use `noEmit`. It also produces a larger bundle (1.33
  MB vs 1.09 MB). rollup needs a config plus 3 plugins. esbuild is a ~15-line
  script.

### Why bump `@actions/tool-cache` to v4 in the same change

`@actions/tool-cache@2` depends on CJS `@actions/core@1.11.1`, so with core v3
at top level, the bundle would ship **two** copies of core plus `http-client@2`
/ `undici@5`. v4 dedupes onto core 3 / http-client 4 / io 3, and clears the
`undici` / `@fastify/busboy` audit findings. The APIs used here (`find`,
`findAllVersions`, `evaluateVersions`, `isExplicitVersion`, `downloadTool`,
`extractTar`, `extractZip`, `cacheDir`) are unchanged and type-check as-is.

## Implementation steps

Do this as one PR on top of current `main`.

### 1. Dependencies

```sh
npm uninstall @vercel/ncc js-yaml @types/semver
npm install @actions/tool-cache@^4.0.0
npm install -D esbuild@^0.28.2
```

`js-yaml` and `@types/semver` are unused (`grep` finds no reference in `src/` or
`.github/`; they're leftovers from the ruff-action lineage). Removing `js-yaml`
clears the last `npm audit` finding. Result: `found 0 vulnerabilities`.

Expected `package.json` dependency blocks:

```json
"dependencies": {
  "@actions/core": "^3.0.1",
  "@actions/tool-cache": "^4.0.0",
  "@octokit/core": "^7.0.6",
  "@octokit/plugin-paginate-rest": "^13.1.1",
  "@octokit/plugin-rest-endpoint-methods": "^16.0.0"
},
"devDependencies": {
  "@biomejs/biome": "2.4.12",
  "@types/node": "^25.6.0",
  "esbuild": "^0.28.2",
  "typescript": "^6.0.2"
}
```

Note: npm ≥ 11.16 prints an `allow-scripts` warning for esbuild's `postinstall`.
It's harmless. esbuild ships its binary through `optionalDependencies`, and the
build was verified after `npm ci --ignore-scripts`.

### 2. `package.json` fields and scripts

- Add `"type": "module"` right after `"private": true`.
- `"main": "dist/setup-air/index.cjs"`
- `"build": "tsc --noEmit"`
- `"package": "node scripts/build-dist.mjs"`
- Leave `format`, `format-check`, `lint`, and `all` unchanged.

### 3. `tsconfig.json` (full replacement)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

Notes:

- `"types": ["node"]` is **required** under TypeScript 6 (default `types` is now
  `[]`). Without it, tsc reports `Cannot find name 'process'` /
  `Cannot find namespace 'NodeJS'` (verified).
- `outDir` / `rootDir` are dropped because nothing is emitted. `noImplicitAny`
  is implied by `strict`. `esModuleInterop` is always on in TS 6.

### 4. `scripts/build-dist.mjs` (new)

```js
import { rm } from "node:fs/promises";
import { build } from "esbuild";

// Output is CommonJS: several transitive deps (tunnel, undici) are still CJS
// and call `require()` on Node builtins, which breaks inside an ESM bundle.
// `.cjs` is required because package.json sets "type": "module".
await rm("dist/setup-air/index.js", { force: true });

await build({
  bundle: true,
  entryPoints: ["src/setup-air.ts"],
  format: "cjs",
  outfile: "dist/setup-air/index.cjs",
  platform: "node",
  target: "node24",
});
```

Paths are relative to the cwd, which is fine because npm runs scripts from the
package root. Biome formats and lints this file cleanly with the current config.

### 5. `action.yml`

```yaml
runs:
  using: "node24"
  main: "dist/setup-air/index.cjs"
```

This is safe for users: a release tag pins `action.yml` and `dist/` together, so
`@v1` users never see a mismatched pair.

### 6. `src/`

No changes required. (No use of `__dirname`, `require`, `import.meta`, or
top-level `await`. esbuild would error or warn at build time if any were
introduced that are incompatible with CJS output.)

### 7. Cleanups

- `.gitignore`: remove the `# Ignore built ts files` / `lib/**/*` block.
- `biome.json`: `"includes": ["**", "!!**/dist", "!!**/node_modules"]` (drop
  `!!**/lib`).
- Delete the local, untracked `lib/` directory (`rm -rf lib`).
- `.gitattributes`: no change needed. `dist/** -diff linguist-generated=true`
  already covers `index.cjs`. Optionally update the comment that names
  `dist/setup-air/index.js`.

### 8. CI (`.github/workflows/test.yml`, `test-hygiene` job)

Install from the lockfile before running the pipeline, so a stale lockfile fails
loudly. The `npm install` inside `npm run all` then becomes a no-op:

```yaml
      - run: npm ci --ignore-scripts
      - run: npm run all
```

The other jobs (`uses: ./`) need no changes. They execute the committed
`dist/setup-air/index.cjs` on ubuntu/macos/windows, and that is the real
end-to-end test of this migration.

### 9. Dependabot (`.github/dependabot.yml`)

Group the toolkit so core and tool-cache majors land together. A split update is
what caused this breakage, and a skew re-duplicates `@actions/core` in the
bundle:

```yaml
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: daily
    groups:
      actions-toolkit:
        patterns: ["@actions/*"]
      octokit:
        patterns: ["@octokit/*"]
```

### 10. Docs

- `CONTRIBUTING.md`:
  - "tsc and ncc - For building `dist/setup-air/index.js`." → "tsc - For type
    checking. esbuild - For bundling `dist/setup-air/index.cjs` (see
    `scripts/build-dist.mjs`)."
  - The two other `dist/setup-air/index.js` mentions → `index.cjs`.
  - Optionally add a short note: source is ESM, `dist` is intentionally CJS
    (`.cjs`) because some transitive deps are still CommonJS. Don't switch to
    ESM output without testing the committed bundle on Node 24.
- `CHANGELOG.md` under "Development version": a bullet such as "Internal:
  migrated to ESM and esbuild, and updated to `@actions/core` v3 and
  `@actions/tool-cache` v4. No user-facing changes."
- README and `examples/` don't reference build internals and need no changes.

### 11. Rebuild and commit

```sh
rm -rf node_modules lib
npm ci
npm run all
git status   # expect: dist/setup-air/index.js deleted, dist/setup-air/index.cjs added
npm run all && git diff --exit-code   # second run must be clean
```

## Verification

### Local (before pushing)

1. `npm run all` succeeds, and a second run leaves no diff.

2. `npm audit` reports 0 vulnerabilities.

3. Smoke-test the bundle under **Node 24** (the action runtime, not your local
   Node) with a simulated runner environment:

   ```sh
   d=$(mktemp -d); : > $d/out; : > $d/path
   env -i PATH=/usr/bin:/bin \
     RUNNER_TOOL_CACHE=$d/cache RUNNER_TEMP=$d/temp \
     GITHUB_OUTPUT=$d/out GITHUB_PATH=$d/path \
     INPUT_VERSION=0.4.x "INPUT_GITHUB-TOKEN=$(gh auth token)" \
     node24 dist/setup-air/index.cjs
   cat $d/out; "$(head -1 $d/path)/air" --version
   ```

   Run with `latest`, `0.4.0`, `0.4.x`, `>=0.4.0`, empty, and a non-existent
   version (expect exit 1 and a single `::error::`). Rerun one version to hit
   the tool cache (`Found airDir in tool-cache ...`).

### CI (on the PR)

- `test-hygiene` passes (proves the committed `dist` matches the source).
- `test-latest-version`, `test-air-version-output`, and `test-on-path` pass on
  **ubuntu, macos, and windows**. Windows is the only coverage for the
  `extractZip` path, and Linux the only coverage for `extractTar` on Linux.
  Neither was exercised locally.
- `test-specific-version` passes for all four version specs.

## Risks and mitigations

  | Risk                                                       | Mitigation                                                                                                                           |
  | ---                                                        | ---                                                                                                                                  |
  | Forgetting to rename `main`, or leaving a stale `index.js` | Build script deletes `index.js`. CI `uses: ./` jobs fail immediately if `main` points at a missing file.                             |
  | Someone later switches to ESM output                       | Comment in `build-dist.mjs` plus a CONTRIBUTING note. Plain ESM output fails at load (`Dynamic require of "net"`), so CI catches it. |
  | Future Dependabot bump of only one `@actions/*` package    | Dependabot `actions-toolkit` group.                                                                                                  |
  | esbuild output differences between machines                | Output contains no absolute paths, and repeated builds are byte-identical (verified). Lockfile pins the esbuild version.             |
  | Windows-specific regressions in tool-cache v4              | CI matrix covers Windows. Rollback is reverting the PR (dist is committed).                                                          |

## Rollback

Revert the PR. The previous `dist/setup-air/index.js` and `action.yml` come back
together. If a quick unblock of `main` is ever needed instead, pin
`@actions/core` back to `^1.11.1`.

## Out of scope (follow-ups)

- Unit tests (jest + ts-jest ESM preset, as in ruff-action's `jest.config.mjs`,
  or `node:test`).
- `.nvmrc` + `node-version-file` in CI, pinned action SHAs, `zizmor` /
  `actionlint`.
- Bumping `@octokit/plugin-rest-endpoint-methods` to 17 (ruff-action is on it).

## Verification already done (POC)

The POC was a copy of `HEAD` with the exact changes above, run under Node
24.22.2 on macOS arm64.

  | Variant                                                   | tsc                                    | Runtime matrix (explicit / latest / range / empty / cache hit / bad version / no token) |
  | ---                                                       | ---                                    | ---                                                                                     |
  | `bundler` + esbuild CJS `.cjs` (**chosen**)               | pass                                   | all pass                                                                                |
  | `nodenext` + esbuild CJS                                  | pass (after adding `.js` to 6 imports) | pass; bundle byte-identical to chosen                                                   |
  | `bundler` + esbuild ESM, no banner                        | pass                                   | **fails at load**: `Dynamic require of "net" is not supported`                          |
  | `bundler` + esbuild ESM + `createRequire` banner          | pass                                   | all pass                                                                                |
  | ncc 0.45 (ESM output)                                     | needs `rootDir`, no `noEmit`           | all pass                                                                                |
  | current ncc-built CJS `index.js` under `"type": "module"` | n/a                                    | **fails**: `__dirname is not defined in ES module scope`                                |

Other checks: `npm run all` is clean on the second run;
`npm ci --ignore-scripts` followed by the build works; `npm audit` reports 0
vulnerabilities; Biome formats and lints the new script with no changes; the
bundle is 1.09 MB (current: 1.22 MB).
